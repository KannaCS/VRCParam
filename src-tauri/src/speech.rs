use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};
use tauri::api::path::app_data_dir;

use crate::osc::{OscState, ParameterType};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandMapping {
    pub command_text: String,
    pub parameter_name: String,
    pub value: f32,
}

#[derive(Debug, Clone)]
pub struct SpeechState {
    commands: Arc<Mutex<HashMap<String, Vec<CommandMapping>>>>,
    app_handle: Option<AppHandle>,
}

impl Default for SpeechState {
    fn default() -> Self {
        Self {
            commands: Arc::new(Mutex::new(HashMap::new())),
            app_handle: None,
        }
    }
}

impl SpeechState {
    pub fn new() -> Self {
        Self {
            commands: Arc::new(Mutex::new(HashMap::new())),
            app_handle: None,
        }
    }

    pub fn initialize(&mut self, app_handle: AppHandle) -> Result<(), String> {
        self.app_handle = Some(app_handle);
        self.load_commands().map_err(|e| format!("Failed to load commands: {}", e))
    }

    fn get_commands_path(&self) -> Result<PathBuf, String> {
        if let Some(app_handle) = &self.app_handle {
            let app_data = app_data_dir(&app_handle.config()).map_err(|e| format!("Failed to get app data directory: {}", e))?;
            let dir_path = app_data.join("commands");
            
            // Ensure the directory exists
            if !dir_path.exists() {
                fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create commands directory: {}", e))?;
            }
            
            Ok(dir_path.join("commands.json"))
        } else {
            Err("App handle not initialized".to_string())
        }
    }

    pub fn save_commands(&self) -> Result<(), String> {
        let path = self.get_commands_path()?;
        let commands = self.commands.lock().unwrap();
        let json = serde_json::to_string_pretty(&*commands)
            .map_err(|e| format!("Failed to serialize commands: {}", e))?;
        
        fs::write(path, json).map_err(|e| format!("Failed to write commands to disk: {}", e))?;
        Ok(())
    }

    pub fn load_commands(&self) -> Result<(), String> {
        let path = match self.get_commands_path() {
            Ok(p) => p,
            Err(e) => return Err(e),
        };
        
        if !path.exists() {
            return Ok(()); // No commands file yet, that's fine
        }
        
        let json = fs::read_to_string(&path).map_err(|e| format!("Failed to read commands file: {}", e))?;
        let loaded_commands: HashMap<String, Vec<CommandMapping>> = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse commands JSON: {}", e))?;
        
        let mut commands = self.commands.lock().unwrap();
        *commands = loaded_commands;
        
        Ok(())
    }

    pub fn add_command_mapping(&self, language: &str, mapping: CommandMapping) -> Result<(), String> {
        let mut commands = self.commands.lock().unwrap();
        let language_commands = commands.entry(language.to_string()).or_insert_with(Vec::new);
        
        // Check if a command with the same text and parameter already exists
        let existing_idx = language_commands.iter().position(|cmd| {
            cmd.command_text == mapping.command_text && cmd.parameter_name == mapping.parameter_name
        });
        
        if let Some(idx) = existing_idx {
            // Update the existing command
            language_commands[idx] = mapping;
        } else {
            // Add new command
            language_commands.push(mapping);
        }
        
        // Save commands to disk
        drop(commands); // Release the lock before saving
        self.save_commands()?;
        
        Ok(())
    }

    pub fn remove_command_mapping(&self, language: &str, command_text: &str, parameter_name: &str) -> Result<bool, String> {
        let mut commands = self.commands.lock().unwrap();
        let mut removed = false;
        
        if let Some(mappings) = commands.get_mut(language) {
            let initial_len = mappings.len();
            mappings.retain(|m| !(m.command_text == command_text && m.parameter_name == parameter_name));
            removed = mappings.len() < initial_len;
        }
        
        // Save commands to disk if something was removed
        if removed {
            drop(commands); // Release the lock before saving
            self.save_commands()?;
        }
        
        Ok(removed)
    }

    pub fn get_commands(&self, language: &str) -> Vec<CommandMapping> {
        let commands = self.commands.lock().unwrap();
        commands.get(language).cloned().unwrap_or_default()
    }

    pub fn process_speech_input(&self, text: &str, language: &str, osc_state: &OscState) -> Result<Vec<String>, String> {
        let mappings = self.get_commands(language);
        let mut processed_commands = Vec::new();

        let text_lower = text.to_lowercase();
        
        for mapping in mappings {
            if text_lower.contains(&mapping.command_text.to_lowercase()) {
                // Find the parameter in our known parameters
                let parameters = osc_state.get_parameters();
                let param_type = parameters
                    .iter()
                    .find(|p| p.name == mapping.parameter_name)
                    .map(|p| &p.parameter_type)
                    .unwrap_or(&ParameterType::Float); // Default to float if not found
                
                // Send the parameter to VRChat via OSC
                match crate::osc::send_parameter(&mapping.parameter_name, mapping.value, param_type) {
                    Ok(_) => {
                        processed_commands.push(format!("{} -> {}: {}", 
                            mapping.command_text, 
                            mapping.parameter_name, 
                            mapping.value
                        ));
                    }
                    Err(e) => {
                        return Err(format!("Failed to send parameter: {}", e));
                    }
                }
            }
        }
        
        Ok(processed_commands)
    }
}

// Tauri commands

#[tauri::command]
pub fn add_command(
    language: &str,
    command_text: &str,
    parameter_name: &str,
    value: f32,
    speech_state: State<SpeechState>,
) -> Result<(), String> {
    let mapping = CommandMapping {
        command_text: command_text.to_string(),
        parameter_name: parameter_name.to_string(),
        value,
    };
    
    speech_state.add_command_mapping(language, mapping)
}

#[tauri::command]
pub fn remove_command(
    language: &str,
    command_text: &str,
    parameter_name: &str,
    speech_state: State<SpeechState>,
) -> Result<bool, String> {
    speech_state.remove_command_mapping(language, command_text, parameter_name)
}

#[tauri::command]
pub fn get_command_mappings(language: &str, speech_state: State<SpeechState>) -> Vec<CommandMapping> {
    speech_state.get_commands(language)
}

#[tauri::command]
pub fn process_speech(
    text: &str,
    language: &str,
    speech_state: State<SpeechState>,
    osc_state: State<OscState>,
) -> Result<Vec<String>, String> {
    speech_state.process_speech_input(text, language, &osc_state)
} 