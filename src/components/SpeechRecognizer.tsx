import { useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useAppStore } from '../store';

interface SpeechRecognizerProps {
  language: string;
}

export function SpeechRecognizer({ language }: SpeechRecognizerProps) {
  const { isListening, toggleListening, processSpeech, setRecognizedText } = useAppStore();
  
  const commands = [
    {
      command: '*',
      callback: async (text: string) => {
        setRecognizedText(text);
        
        if (text.trim().length > 0) {
          const processedCommands = await processSpeech(text, language);
          console.log('Processed commands:', processedCommands);
        }
      },
    },
  ];
  
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition({ commands });

  useEffect(() => {
    if (isListening && !listening) {
      SpeechRecognition.startListening({ 
        continuous: true,
        language 
      });
    } else if (!isListening && listening) {
      SpeechRecognition.stopListening();
    }
  }, [isListening, listening, language]);

  useEffect(() => {
    // Sync the listening state with our store
    if (listening !== isListening) {
      toggleListening();
    }
  }, [listening]);

  if (!browserSupportsSpeechRecognition) {
    return <div className="bg-red-100 dark:bg-red-900 p-4 rounded-md mb-4">
      Your browser does not support speech recognition.
    </div>;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center space-x-2 mb-2">
        <button
          onClick={toggleListening}
          className={`px-4 py-2 rounded-md transition-colors ${
            isListening 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </button>
        
        <button
          onClick={resetTranscript}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          Clear
        </button>
      </div>
      
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md min-h-24 max-h-48 overflow-auto">
        <p className="text-gray-800 dark:text-gray-200">
          {transcript || 'Waiting for speech input...'}
        </p>
      </div>
      
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Status: {isListening ? 'Listening...' : 'Not listening'} | Language: {language}
      </div>
    </div>
  );
} 