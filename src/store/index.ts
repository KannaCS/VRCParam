import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AppConfig, CommandMapping, OscConfig, Parameter } from '../types';
import { persist } from 'zustand/middleware';

export interface AppState {
  // Parameters
  parameters: Parameter[];
  isLoadingParameters: boolean;
  parametersError: string | null;
  fetchParameters: () => Promise<void>;
  setParameterValue: (name: string, value: number, paramType: string) => Promise<void>;
  
  // Speech Commands
  commands: CommandMapping[];
  isLoadingCommands: boolean;
  commandsError: string | null;
  fetchCommands: (language: string) => Promise<void>;
  addCommand: (language: string, commandText: string, parameterName: string, value: number) => Promise<void>;
  removeCommand: (language: string, commandText: string, parameterName: string) => Promise<boolean>;
  processSpeech: (text: string, language: string) => Promise<string[]>;
  
  // Speech Recognition
  isListening: boolean;
  toggleListening: () => void;
  recognizedText: string;
  setRecognizedText: (text: string) => void;
  
  // OSC Configuration
  oscConfig: OscConfig;
  updateOscConfig: (config: Partial<OscConfig>) => Promise<void>;
  restartOscListener: () => Promise<void>;
  
  // App Config
  config: AppConfig;
  setConfig: (config: Partial<AppConfig>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Parameters
      parameters: [],
      isLoadingParameters: false,
      parametersError: null,
      fetchParameters: async () => {
        try {
          set({ isLoadingParameters: true, parametersError: null });
          const params = await invoke<Parameter[]>('get_all_parameters');
          set({ parameters: params, isLoadingParameters: false });
        } catch (error) {
          console.error('Failed to fetch parameters:', error);
          set({ 
            isLoadingParameters: false, 
            parametersError: `Failed to fetch parameters: ${error}` 
          });
        }
      },
      setParameterValue: async (name, value, paramType) => {
        try {
          await invoke('set_parameter_value', { name, value, paramTypeStr: paramType });
          set(state => ({
            parameters: state.parameters.map(param => 
              param.name === name ? { ...param, value } : param
            ),
          }));
        } catch (error) {
          console.error('Failed to set parameter value:', error);
          throw error;
        }
      },
      
      // Speech Commands
      commands: [],
      isLoadingCommands: false,
      commandsError: null,
      fetchCommands: async (language) => {
        try {
          set({ isLoadingCommands: true, commandsError: null });
          const cmds = await invoke<CommandMapping[]>('get_command_mappings', { language });
          set({ commands: cmds, isLoadingCommands: false });
        } catch (error) {
          console.error('Failed to fetch commands:', error);
          set({ 
            isLoadingCommands: false, 
            commandsError: `Failed to fetch commands: ${error}` 
          });
        }
      },
      addCommand: async (language, commandText, parameterName, value) => {
        try {
          await invoke('add_command', { language, commandText, parameterName, value });
          await get().fetchCommands(language);
        } catch (error) {
          console.error('Failed to add command:', error);
          throw error;
        }
      },
      removeCommand: async (language, commandText, parameterName) => {
        try {
          const result = await invoke<boolean>('remove_command', { language, commandText, parameterName });
          await get().fetchCommands(language);
          return result;
        } catch (error) {
          console.error('Failed to remove command:', error);
          throw error;
        }
      },
      processSpeech: async (text, language) => {
        try {
          return await invoke<string[]>('process_speech', { text, language });
        } catch (error) {
          console.error('Failed to process speech:', error);
          throw error;
        }
      },
      
      // Speech Recognition
      isListening: false,
      toggleListening: () => set(state => ({ isListening: !state.isListening })),
      recognizedText: '',
      setRecognizedText: (text) => set({ recognizedText: text }),
      
      // OSC Configuration
      oscConfig: {
        targetAddress: '127.0.0.1',
        targetPort: 9000,
        listenAddress: '127.0.0.1',
        listenPort: 9001,
      },
      updateOscConfig: async (config) => {
        const currentConfig = get().oscConfig;
        const newConfig = { ...currentConfig, ...config };
        
        try {
          await invoke('update_osc_config', {
            targetAddress: newConfig.targetAddress,
            targetPort: newConfig.targetPort,
            listenAddress: newConfig.listenAddress,
            listenPort: newConfig.listenPort,
          });
          
          set({ oscConfig: newConfig });
        } catch (error) {
          console.error('Failed to update OSC config:', error);
          throw error;
        }
      },
      restartOscListener: async () => {
        try {
          await invoke('restart_osc_listener');
        } catch (error) {
          console.error('Failed to restart OSC listener:', error);
          throw error;
        }
      },
      
      // App Config
      config: {
        language: 'en-US',
        oscAddress: '127.0.0.1',
        oscPort: 9000,
        enableVoiceControl: true,
        enableParameterTracking: true,
        theme: 'system',
      },
      setConfig: (newConfig) => set(state => ({ 
        config: { ...state.config, ...newConfig } 
      })),
    }),
    {
      name: 'vrcparam-storage',
      partialize: (state) => ({ 
        config: state.config,
        oscConfig: state.oscConfig,
      }),
    }
  )
);

// Listen for parameter updates from the Rust backend
const setupEventListeners = async () => {
  await listen<Parameter[]>('parameter-updated', (event) => {
    const params = event.payload;
    useAppStore.setState({
      parameters: params,
      isLoadingParameters: false,
      parametersError: null,
    });
  });
};

// Initialize event listeners
setupEventListeners().catch(console.error); 