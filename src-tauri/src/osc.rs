use anyhow::{anyhow, Result};
use rosc::{OscMessage, OscPacket, OscType};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::{SocketAddr, UdpSocket},
    str::FromStr,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager, State};

// Default OSC addresses for VRChat
const DEFAULT_VRC_ADDRESS: &str = "127.0.0.1:9000"; // Send to VRChat
const DEFAULT_LISTEN_ADDRESS: &str = "127.0.0.1:9001"; // Listen from VRChat

// Parameter types supported by VRChat
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParameterType {
    Float,
    Int,
    Bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameter {
    pub name: String,
    pub parameter_type: ParameterType,
    pub value: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OscConfig {
    pub target_address: String,
    pub target_port: u16,
    pub listen_address: String,
    pub listen_port: u16,
}

impl Default for OscConfig {
    fn default() -> Self {
        Self {
            target_address: "127.0.0.1".to_string(),
            target_port: 9000,
            listen_address: "127.0.0.1".to_string(),
            listen_port: 9001,
        }
    }
}

#[derive(Debug, Default)]
pub struct OscState {
    parameters: Arc<Mutex<HashMap<String, Parameter>>>,
    config: Arc<Mutex<OscConfig>>,
    listener_thread: Arc<Mutex<Option<thread::JoinHandle<()>>>>,
    running: Arc<Mutex<bool>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl OscState {
    pub fn new() -> Self {
        Self {
            parameters: Arc::new(Mutex::new(HashMap::new())),
            config: Arc::new(Mutex::new(OscConfig::default())),
            listener_thread: Arc::new(Mutex::new(None)),
            running: Arc::new(Mutex::new(false)),
            app_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub fn initialize(&self, app_handle: AppHandle) {
        let mut app_handle_ref = self.app_handle.lock().unwrap();
        *app_handle_ref = Some(app_handle);
    }

    // Get all parameters
    pub fn get_parameters(&self) -> Vec<Parameter> {
        let params = self.parameters.lock().unwrap();
        params.values().cloned().collect()
    }

    // Set parameter value
    pub fn set_parameter(&self, name: &str, value: f32) -> Result<()> {
        let mut params = self.parameters.lock().unwrap();
        
        if let Some(param) = params.get_mut(name) {
            param.value = value;
            Ok(())
        } else {
            Err(anyhow!("Parameter not found: {}", name))
        }
    }

    // Add or update parameter
    pub fn update_parameter(&self, param: Parameter) {
        let mut params = self.parameters.lock().unwrap();
        params.insert(param.name.clone(), param);
        
        // Notify frontend of parameter updates if app handle is available
        if let Some(app_handle) = self.app_handle.lock().unwrap().as_ref() {
            // We don't want to block on this, so we just try to emit and ignore errors
            let _ = app_handle.emit_all("parameter-updated", self.get_parameters());
        }
    }
    
    // Update OSC configuration
    pub fn update_config(&self, new_config: OscConfig) -> Result<()> {
        let mut config = self.config.lock().unwrap();
        
        // Check if the configuration has changed
        let config_changed = config.target_address != new_config.target_address 
            || config.target_port != new_config.target_port
            || config.listen_address != new_config.listen_address
            || config.listen_port != new_config.listen_port;
            
        // Update config
        *config = new_config;
        
        // If the configuration has changed and we're running, restart the listener
        if config_changed {
            drop(config);  // Release lock before calling other methods
            
            // Stop and restart the listener
            if *self.running.lock().unwrap() {
                self.stop_listener()?;
                self.start_listener()?;
            }
        }
        
        Ok(())
    }
    
    // Get current OSC configuration
    pub fn get_config(&self) -> OscConfig {
        self.config.lock().unwrap().clone()
    }
    
    // Start OSC listener with current configuration
    pub fn start_listener(&self) -> Result<()> {
        let mut running = self.running.lock().unwrap();
        if *running {
            return Ok(());  // Already running
        }
        
        let config = self.config.lock().unwrap().clone();
        let listen_addr = format!("{}:{}", config.listen_address, config.listen_port);
        let socket_addr = SocketAddr::from_str(&listen_addr)?;
        let socket = UdpSocket::bind(socket_addr)?;
        socket.set_nonblocking(true)?;
        
        log::info!("OSC listener started on {}", listen_addr);
        
        let params = self.parameters.clone();
        let running_ref = self.running.clone();
        let app_handle_ref = self.app_handle.clone();
        
        *running = true;
        
        // Spawn a thread to listen for OSC messages
        let handle = thread::spawn(move || {
            let mut buf = [0u8; 1024];
            
            while *running_ref.lock().unwrap() {
                match socket.recv_from(&mut buf) {
                    Ok((size, _addr)) => {
                        if let Ok((_, packet)) = rosc::decoder::decode_udp(&buf[..size]) {
                            let mut parameter_updated = false;
                            
                            // Process the packet and track if parameters were updated
                            if let Some(param) = process_osc_packet(packet, &params) {
                                parameter_updated = true;
                                
                                // Notify frontend if we have the app handle
                                if parameter_updated {
                                    if let Some(app) = app_handle_ref.lock().unwrap().as_ref() {
                                        let params_clone = {
                                            let params_lock = params.lock().unwrap();
                                            params_lock.values().cloned().collect::<Vec<_>>()
                                        };
                                        
                                        // Try to emit the updated parameters, but don't block if it fails
                                        let _ = app.emit_all("parameter-updated", params_clone);
                                    }
                                }
                            }
                        }
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(e) => {
                        log::error!("Error receiving OSC: {}", e);
                        thread::sleep(Duration::from_millis(100));
                    }
                }
            }
        });
        
        let mut thread_ref = self.listener_thread.lock().unwrap();
        *thread_ref = Some(handle);
        
        Ok(())
    }
    
    // Stop OSC listener
    pub fn stop_listener(&self) -> Result<()> {
        let mut running = self.running.lock().unwrap();
        if !*running {
            return Ok(());  // Not running
        }
        
        // Signal thread to stop
        *running = false;
        
        // Join thread
        if let Some(handle) = self.listener_thread.lock().unwrap().take() {
            // Give the thread a bit of time to exit cleanly
            if handle.join().is_err() {
                log::warn!("OSC listener thread did not exit cleanly");
            }
        }
        
        Ok(())
    }
}

// Process incoming OSC packet
fn process_osc_packet(packet: OscPacket, params: &Arc<Mutex<HashMap<String, Parameter>>>) -> Option<Parameter> {
    match packet {
        OscPacket::Message(msg) => {
            process_osc_message(msg, params)
        }
        OscPacket::Bundle(bundle) => {
            let mut updated_param = None;
            for packet in bundle.content {
                if let Some(param) = process_osc_packet(packet, params) {
                    updated_param = Some(param);
                }
            }
            updated_param
        }
    }
}

// Process OSC message and extract parameter data
fn process_osc_message(msg: OscMessage, params: &Arc<Mutex<HashMap<String, Parameter>>>) -> Option<Parameter> {
    // Only process avatar parameter messages
    if msg.addr.starts_with("/avatar/parameters/") {
        let param_name = msg.addr.trim_start_matches("/avatar/parameters/").to_string();

        if let Some(value) = msg.args.first() {
            let (value, param_type) = match value {
                OscType::Float(f) => (*f, ParameterType::Float),
                OscType::Int(i) => (*i as f32, ParameterType::Int),
                OscType::Bool(b) => {
                    if *b {
                        (1.0, ParameterType::Bool)
                    } else {
                        (0.0, ParameterType::Bool)
                    }
                }
                _ => return None, // Unsupported type
            };

            let param = Parameter {
                name: param_name,
                parameter_type: param_type,
                value,
            };
            
            let mut params_map = params.lock().unwrap();
            params_map.insert(param.name.clone(), param.clone());
            
            return Some(param);
        }
    }
    
    None
}

// Send OSC message to VRChat
pub fn send_parameter(param_name: &str, value: f32, param_type: &ParameterType, osc_state: &OscState) -> Result<()> {
    let config = osc_state.get_config();
    let addr = format!("/avatar/parameters/{}", param_name);
    
    let arg = match param_type {
        ParameterType::Float => OscType::Float(value),
        ParameterType::Int => OscType::Int(value as i32),
        ParameterType::Bool => OscType::Bool(value > 0.5),
    };
    
    let msg = OscMessage {
        addr,
        args: vec![arg],
    };
    
    let packet = OscPacket::Message(msg);
    let dest_addr = format!("{}:{}", config.target_address, config.target_port);
    let dest_socket_addr = SocketAddr::from_str(&dest_addr)?;
    
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    let encoded = rosc::encoder::encode(&packet)?;
    socket.send_to(&encoded, dest_socket_addr)?;
    
    Ok(())
}

// Tauri commands

#[tauri::command]
pub fn get_all_parameters(state: State<OscState>) -> Vec<Parameter> {
    state.get_parameters()
}

#[tauri::command]
pub fn set_parameter_value(
    name: &str,
    value: f32,
    param_type_str: &str,
    state: State<OscState>,
) -> Result<(), String> {
    let param_type = match param_type_str {
        "Float" => ParameterType::Float,
        "Int" => ParameterType::Int,
        "Bool" => ParameterType::Bool,
        _ => return Err("Invalid parameter type".into()),
    };
    
    send_parameter(name, value, &param_type, &state)
        .map_err(|e| format!("Failed to send parameter: {}", e))?;
    
    state.set_parameter(name, value).map_err(|e| format!("Failed to update parameter: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn update_osc_config(
    target_address: &str,
    target_port: u16,
    listen_address: &str,
    listen_port: u16,
    state: State<OscState>,
) -> Result<(), String> {
    let config = OscConfig {
        target_address: target_address.to_string(),
        target_port,
        listen_address: listen_address.to_string(),
        listen_port,
    };
    
    state.update_config(config)
        .map_err(|e| format!("Failed to update OSC config: {}", e))
}

#[tauri::command]
pub fn get_osc_config(state: State<OscState>) -> OscConfig {
    state.get_config()
}

#[tauri::command]
pub fn restart_osc_listener(state: State<OscState>) -> Result<(), String> {
    state.stop_listener()
        .map_err(|e| format!("Failed to stop OSC listener: {}", e))?;
    
    state.start_listener()
        .map_err(|e| format!("Failed to start OSC listener: {}", e))
} 