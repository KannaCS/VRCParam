import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Parameter } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

export function CommandManager() {
  const { parameters, commands, addCommand, removeCommand, fetchCommands, config } = useAppStore();
  const [commandText, setCommandText] = useState('');
  const [selectedParameter, setSelectedParameter] = useState('');
  const [parameterValue, setParameterValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadCommands = async () => {
      setIsLoading(true);
      try {
        await fetchCommands(config.language);
        setError(null);
      } catch (err) {
        setError('Failed to load commands');
        console.error('Error loading commands:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCommands();
  }, [fetchCommands, config.language]);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleAddCommand = async () => {
    if (!commandText || !selectedParameter) return;
    
    setIsLoading(true);
    try {
      await addCommand(
        config.language,
        commandText.toLowerCase(),
        selectedParameter,
        parameterValue
      );
      
      // Reset form
      setCommandText('');
      setSelectedParameter('');
      setParameterValue(0);
      setError(null);
      showSuccess('Command added successfully!');
    } catch (err) {
      setError('Failed to add command');
      console.error('Error adding command:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCommand = async (command: string, parameter: string) => {
    setIsLoading(true);
    try {
      const removed = await removeCommand(config.language, command, parameter);
      if (removed) {
        showSuccess('Command removed successfully!');
      }
      setError(null);
    } catch (err) {
      setError('Failed to remove command');
      console.error('Error removing command:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Voice Command Mappings</h2>
      
      {/* Notification messages */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-200"
          >
            {successMessage}
          </motion.div>
        )}
        
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-200"
          >
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Add New Command Form */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md mb-6 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">Add New Command</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Voice Command</label>
            <input
              type="text"
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              placeholder="e.g., 'activate jump'"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              What you'll say to trigger this parameter change
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Parameter</label>
            <select
              value={selectedParameter}
              onChange={(e) => setSelectedParameter(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              disabled={isLoading || parameters.length === 0}
            >
              <option value="">Select a parameter</option>
              {parameters.map((param: Parameter) => (
                <option key={param.name} value={param.name}>
                  {param.name}
                </option>
              ))}
            </select>
            {parameters.length === 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                No parameters available. Make sure VRChat is running.
              </p>
            )}
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Value</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={parameterValue}
            onChange={(e) => setParameterValue(parseFloat(e.target.value))}
            className="w-full accent-blue-600"
            disabled={isLoading}
          />
          <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
            <span>0</span>
            <span>{parameterValue.toFixed(2)}</span>
            <span>1</span>
          </div>
        </div>
        
        <button
          onClick={handleAddCommand}
          disabled={!commandText || !selectedParameter || isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Adding...
            </>
          ) : (
            'Add Command'
          )}
        </button>
      </div>
      
      {/* Command List */}
      {isLoading && commands.length === 0 ? (
        <div className="flex justify-center items-center p-8">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : commands.length === 0 ? (
        <div className="text-center p-6 bg-gray-100 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700">
          <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <p className="text-gray-700 dark:text-gray-300 mb-2">No commands defined yet</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Add a command above to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {commands.map((cmd) => (
              <motion.div 
                key={`${cmd.command_text}-${cmd.parameter_name}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-md flex justify-between items-center bg-white dark:bg-gray-800"
              >
                <div>
                  <div className="font-medium text-gray-800 dark:text-gray-200">"{cmd.command_text}"</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                    <span className="mr-1">{cmd.parameter_name}</span>
                    <svg className="w-3 h-3 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded">
                      {cmd.value.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleRemoveCommand(cmd.command_text, cmd.parameter_name)}
                  disabled={isLoading}
                  className="px-3 py-1 bg-red-100 text-red-600 hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 rounded-md text-sm transition-colors flex items-center"
                >
                  {isLoading ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : "Remove"}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
} 