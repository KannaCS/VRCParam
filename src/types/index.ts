export enum ParameterType {
  Float = 'Float',
  Int = 'Int',
  Bool = 'Bool',
}

export interface Parameter {
  name: string;
  parameter_type: ParameterType;
  value: number;
}

export interface CommandMapping {
  command_text: string;
  parameter_name: string;
  value: number;
}

export interface OscConfig {
  targetAddress: string;
  targetPort: number;
  listenAddress: string;
  listenPort: number;
}

export interface AppConfig {
  language: string;
  oscAddress: string; 
  oscPort: number;
  enableVoiceControl: boolean;
  enableParameterTracking: boolean;
  theme: 'light' | 'dark' | 'system';
} 