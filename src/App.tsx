import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import { ParameterList } from "./components/ParameterList";
import { CommandManager } from "./components/CommandManager";
import { SpeechRecognizer } from "./components/SpeechRecognizer";
import { useAppStore } from "./store";

function App() {
  const [activeTab, setActiveTab] = useState<'parameters' | 'commands' | 'settings'>('parameters');
  const { 
    config, 
    setConfig, 
    fetchParameters, 
    fetchCommands, 
    oscConfig,
    updateOscConfig,
    restartOscListener
  } = useAppStore();
  const [isUpdatingOsc, setIsUpdatingOsc] = useState(false);
  const [oscUpdateSuccess, setOscUpdateSuccess] = useState<string | null>(null);
  const [oscUpdateError, setOscUpdateError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial data
    fetchParameters();
    fetchCommands(config.language);
    
    // Start polling for parameters
    const intervalId = setInterval(() => {
      fetchParameters();
    }, 3000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchParameters, fetchCommands, config.language]);

  const handleOscConfigUpdate = async () => {
    setIsUpdatingOsc(true);
    setOscUpdateSuccess(null);
    setOscUpdateError(null);

    try {
      await updateOscConfig({
        targetAddress: oscConfig.targetAddress,
        targetPort: oscConfig.targetPort,
        listenAddress: oscConfig.listenAddress,
        listenPort: oscConfig.listenPort,
      });

      await restartOscListener();
      setOscUpdateSuccess("OSC configuration updated successfully!");
      setTimeout(() => setOscUpdateSuccess(null), 3000);
    } catch (error) {
      setOscUpdateError(`Failed to update OSC configuration: ${error}`);
    } finally {
      setIsUpdatingOsc(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
          VRCParam
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Control VRChat parameters with voice commands</p>
      </motion.header>

      {/* Tabs */}
      <div className="flex mb-8 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
        {[
          { id: 'parameters', label: 'Parameters' },
          { id: 'commands', label: 'Commands' },
          { id: 'settings', label: 'Settings' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`relative flex-1 py-3 px-4 text-center rounded-md z-10 transition-all duration-200 ${
              activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-blue-500 rounded-md"
                style={{ zIndex: -1 }}
                transition={{ type: "spring", duration: 0.6 }}
              />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg"
        >
          {activeTab === 'parameters' && (
            <div>
              <h2 className="text-xl font-semibold mb-6 flex items-center text-gray-800 dark:text-gray-200">
                <motion.div 
                  className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </motion.div>
                Parameters
              </h2>

              {/* Parameter List Component */}
              <ParameterList />
            </div>
          )}

          {activeTab === 'commands' && (
            <div>
              <h2 className="text-xl font-semibold mb-6 flex items-center text-gray-800 dark:text-gray-200">
                <motion.div 
                  className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center mr-3"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </motion.div>
                Voice Commands
              </h2>

              {/* Speech Recognition Component */}
              <SpeechRecognizer language={config.language} />
              
              {/* Command Manager Component */}
              <CommandManager />
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 className="text-xl font-semibold mb-6 flex items-center text-gray-800 dark:text-gray-200">
                <motion.div 
                  className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mr-3"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </motion.div>
                Settings
              </h2>

              <div className="space-y-6">
                {/* Notification messages */}
                <AnimatePresence>
                  {oscUpdateSuccess && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-200"
                    >
                      {oscUpdateSuccess}
                    </motion.div>
                  )}
                  
                  {oscUpdateError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-200"
                    >
                      {oscUpdateError}
                      <button
                        onClick={() => setOscUpdateError(null)}
                        className="ml-2 text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
                      >
                        Dismiss
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div 
                  className="p-5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300"
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">Voice Recognition</h3>
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={config.enableVoiceControl}
                          onChange={(e) => setConfig({ enableVoiceControl: e.target.checked })}
                        />
                        <div 
                          className={`block w-14 h-8 rounded-full ${
                            config.enableVoiceControl ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        />
                        <div 
                          className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                            config.enableVoiceControl ? 'transform translate-x-6' : ''
                          }`}
                        />
                      </div>
                      <span className="text-gray-800 dark:text-gray-200">Enable Voice Recognition</span>
                    </label>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Language</label>
                      <select 
                        className="w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        value={config.language}
                        onChange={(e) => setConfig({ language: e.target.value })}
                      >
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="ja-JP">Japanese</option>
                        <option value="es-ES">Spanish</option>
                        <option value="fr-FR">French</option>
                        <option value="de-DE">German</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="p-5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300"
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">OSC Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Address</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        value={oscConfig.targetAddress}
                        onChange={(e) => updateOscConfig({ targetAddress: e.target.value })}
                        placeholder="127.0.0.1"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        VRChat OSC address to send parameters to
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Port</label>
                      <input 
                        type="number" 
                        className="w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        value={oscConfig.targetPort}
                        onChange={(e) => updateOscConfig({ targetPort: parseInt(e.target.value) })}
                        placeholder="9000"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        VRChat OSC port (default: 9000)
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Listen Address</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        value={oscConfig.listenAddress}
                        onChange={(e) => updateOscConfig({ listenAddress: e.target.value })}
                        placeholder="127.0.0.1"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Address to listen for parameters from VRChat
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Listen Port</label>
                      <input 
                        type="number" 
                        className="w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        value={oscConfig.listenPort}
                        onChange={(e) => updateOscConfig({ listenPort: parseInt(e.target.value) })}
                        placeholder="9001"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Port to listen on (default: 9001)
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleOscConfigUpdate}
                    disabled={isUpdatingOsc}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {isUpdatingOsc ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </>
                    ) : 'Apply OSC Settings'}
                  </button>
                </motion.div>
                
                <motion.div 
                  className="p-5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300"
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">Appearance</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theme</label>
                    <select 
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      value={config.theme}
                      onChange={(e) => setConfig({ theme: e.target.value as 'light' | 'dark' | 'system' })}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default App;
