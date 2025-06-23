use std::sync::Arc;

mod osc;
mod speech;

use osc::OscState;
use speech::SpeechState;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let osc_state = Arc::new(OscState::new());
    let speech_state = SpeechState::new();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(osc_state.clone())
        .manage(speech_state)
        .setup(|app| {
            let app_handle = app.handle();
            
            // Get managed states and initialize them with the app handle
            let speech_state = app.state::<SpeechState>();
            let mut speech_state_mut = speech_state.inner().clone();
            
            if let Err(e) = speech_state_mut.initialize(app_handle.clone()) {
                log::error!("Failed to initialize speech state: {}", e);
            }
            
            // Initialize OSC state
            let osc_state = app.state::<OscState>();
            osc_state.initialize(app_handle.clone());
            
            // Start the OSC listener in a separate thread
            if let Err(e) = osc_state.start_listener() {
                log::error!("Failed to start OSC listener: {}", e);
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            osc::get_all_parameters,
            osc::set_parameter_value,
            osc::update_osc_config,
            osc::get_osc_config,
            osc::restart_osc_listener,
            speech::add_command,
            speech::remove_command,
            speech::get_command_mappings,
            speech::process_speech,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
