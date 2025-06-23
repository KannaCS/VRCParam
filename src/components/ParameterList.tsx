import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { Parameter, ParameterType } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

export function ParameterList() {
  const { parameters, fetchParameters, setParameterValue } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchParams = async () => {
      try {
        setIsLoading(true);
        await fetchParameters();
        setError(null);
      } catch (err) {
        setError('Failed to fetch parameters. Make sure VRChat is running with OSC enabled.');
        console.error('Error fetching parameters:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchParams();
    const intervalId = setInterval(fetchParams, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchParameters]);

  const handleValueChange = async (param: Parameter, newValue: number) => {
    try {
      await setParameterValue(
        param.name,
        newValue,
        param.parameter_type
      );
    } catch (err) {
      console.error('Error setting parameter value:', err);
    }
  };

  const renderControl = (param: Parameter) => {
    switch (param.parameter_type) {
      case ParameterType.Bool:
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={param.value > 0.5}
              onChange={(e) => handleValueChange(param, e.target.checked ? 1 : 0)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-gray-800 dark:text-gray-200">
              {param.value > 0.5 ? 'True' : 'False'}
            </span>
          </div>
        );
      case ParameterType.Int:
        return (
          <div className="flex flex-col">
            <input
              type="range"
              min="0"
              max="255"
              step="1"
              value={param.value}
              onChange={(e) => handleValueChange(param, parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600 dark:text-gray-400">0</span>
              <span className="text-gray-800 dark:text-gray-200">{Math.round(param.value)}</span>
              <span className="text-gray-600 dark:text-gray-400">255</span>
            </div>
          </div>
        );
      case ParameterType.Float:
      default:
        return (
          <div className="flex flex-col">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={param.value}
              onChange={(e) => handleValueChange(param, parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600 dark:text-gray-400">0.0</span>
              <span className="text-gray-800 dark:text-gray-200">{param.value.toFixed(2)}</span>
              <span className="text-gray-600 dark:text-gray-400">1.0</span>
            </div>
          </div>
        );
    }
  };

  if (isLoading && parameters.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-t-2 border-blue-500 border-solid rounded-full mb-4"
        />
        <p className="text-gray-600 dark:text-gray-400">Loading parameters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg text-center"
      >
        <div className="flex flex-col items-center">
          <svg className="w-12 h-12 text-red-400 dark:text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-800 dark:text-gray-200 mb-3">{error}</p>
          <button
            className="px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-100 rounded-md hover:bg-red-200 dark:hover:bg-red-700"
            onClick={() => fetchParameters()}
          >
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  if (parameters.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg text-center"
      >
        <div className="flex flex-col items-center">
          <svg className="w-12 h-12 text-yellow-400 dark:text-yellow-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-800 dark:text-gray-200 mb-2">No parameters detected</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Make sure VRChat is running with OSC enabled</p>
          <button
            className="px-4 py-2 bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-100 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-700"
            onClick={() => fetchParameters()}
          >
            Refresh
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {parameters.map((param) => (
          <motion.div
            key={param.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm hover:shadow-md transition-shadow duration-300 bg-white dark:bg-gray-800"
          >
            <h3 className="font-medium mb-2 text-gray-800 dark:text-gray-200 flex items-center justify-between">
              <span className="truncate mr-2" title={param.name}>{param.name}</span>
              <span className="text-xs py-1 px-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full whitespace-nowrap">
                {param.parameter_type}
              </span>
            </h3>
            <div className="mt-2">{renderControl(param)}</div>
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  );
} 