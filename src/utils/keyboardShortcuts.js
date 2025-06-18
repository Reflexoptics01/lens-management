/**
 * Priority-based Keyboard Shortcut Manager
 * Handles global and component-specific shortcuts with proper priority handling
 */

import { useEffect } from 'react';

class KeyboardShortcutManager {
  constructor() {
    this.shortcuts = new Map();
    this.contextStack = [];
    this.isListening = false;
    this.activeModalOrComponent = null;
    
    // Bind the handler
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Start listening for keyboard events
   */
  startListening() {
    if (!this.isListening) {
      document.addEventListener('keydown', this.handleKeyDown, true);
      this.isListening = true;
    }
  }

  /**
   * Stop listening for keyboard events
   */
  stopListening() {
    if (this.isListening) {
      document.removeEventListener('keydown', this.handleKeyDown, true);
      this.isListening = false;
    }
  }

  /**
   * Register a shortcut with priority
   * @param {string} key - The key combination (e.g., 'g', 'ctrl+s', 'escape')
   * @param {Function} handler - The function to call
   * @param {Object} options - Options including priority, context, description
   */
  register(key, handler, options = {}) {
    const {
      priority = 'normal', // 'high', 'normal', 'low'
      context = 'global', // 'global', 'modal', 'component', or specific context name
      description = '',
      preventDefault = true,
      condition = null // Optional condition function to check if shortcut should be active
    } = options;

    const normalizedKey = this.normalizeKey(key);
    
    if (!this.shortcuts.has(normalizedKey)) {
      this.shortcuts.set(normalizedKey, []);
    }

    const shortcut = {
      key: normalizedKey,
      handler,
      priority,
      context,
      description,
      preventDefault,
      condition,
      id: `${context}-${priority}-${Date.now()}-${Math.random()}`
    };

    this.shortcuts.get(normalizedKey).push(shortcut);
    
    // Sort by priority (high -> normal -> low)
    this.shortcuts.get(normalizedKey).sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return shortcut.id;
  }

  /**
   * Unregister a shortcut by ID
   */
  unregister(shortcutId) {
    for (const [key, shortcuts] of this.shortcuts.entries()) {
      const index = shortcuts.findIndex(s => s.id === shortcutId);
      if (index !== -1) {
        shortcuts.splice(index, 1);
        if (shortcuts.length === 0) {
          this.shortcuts.delete(key);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Set the active modal or component context
   */
  setActiveContext(contextName) {
    this.activeModalOrComponent = contextName;
  }

  /**
   * Clear the active context
   */
  clearActiveContext() {
    this.activeModalOrComponent = null;
  }

  /**
   * Push a context to the stack (for nested contexts)
   */
  pushContext(contextName) {
    this.contextStack.push(contextName);
    this.activeModalOrComponent = contextName;
  }

  /**
   * Pop a context from the stack
   */
  popContext() {
    this.contextStack.pop();
    this.activeModalOrComponent = this.contextStack.length > 0 
      ? this.contextStack[this.contextStack.length - 1] 
      : null;
  }

  /**
   * Normalize key combinations
   */
  normalizeKey(key) {
    return key.toLowerCase()
      .replace(/\s+/g, '')
      .replace('meta', 'cmd')
      .replace('command', 'cmd')
      .split('+')
      .sort()
      .join('+');
  }

  /**
   * Convert keyboard event to normalized key string
   */
  eventToKey(event) {
    const parts = [];
    
    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey && event.key.length > 1) parts.push('shift'); // Only add shift for special keys
    if (event.metaKey) parts.push('cmd');
    
    let key = event.key.toLowerCase();
    
    // Special key mappings
    const keyMap = {
      ' ': 'space',
      'arrowup': 'up',
      'arrowdown': 'down',
      'arrowleft': 'left',
      'arrowright': 'right',
      'escape': 'escape'
    };
    
    key = keyMap[key] || key;
    parts.push(key);
    
    return parts.sort().join('+');
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(event) {
    // Skip if user is typing in an input field (unless it's escape)
    if (this.isInputField(event.target) && event.key !== 'Escape') {
      return;
    }

    const eventKey = this.eventToKey(event);
    const shortcuts = this.shortcuts.get(eventKey);
    
    if (!shortcuts || shortcuts.length === 0) {
      return;
    }

    // Find the best matching shortcut based on current context and priority
    const activeShortcut = this.findActiveShortcut(shortcuts);
    
    if (activeShortcut) {
      // Check condition if provided
      if (activeShortcut.condition && !activeShortcut.condition()) {
        return;
      }

      if (activeShortcut.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      try {
        activeShortcut.handler(event);
      } catch (error) {
        console.error('Keyboard shortcut handler error:', error);
      }
    }
  }

  /**
   * Find the active shortcut based on current context
   */
  findActiveShortcut(shortcuts) {
    // First, try to find shortcuts for the active modal/component context
    if (this.activeModalOrComponent) {
      const contextShortcut = shortcuts.find(s => s.context === this.activeModalOrComponent);
      if (contextShortcut) {
        return contextShortcut;
      }
      
      // Also check for 'modal' or 'component' generic contexts
      const genericContextShortcut = shortcuts.find(s => 
        s.context === 'modal' || s.context === 'component'
      );
      if (genericContextShortcut) {
        return genericContextShortcut;
      }
    }

    // Fallback to global shortcuts
    const globalShortcut = shortcuts.find(s => s.context === 'global');
    return globalShortcut;
  }

  /**
   * Check if the target is an input field
   */
  isInputField(target) {
    const inputTypes = ['input', 'textarea', 'select'];
    const tagName = target.tagName.toLowerCase();
    
    return inputTypes.includes(tagName) || 
           target.contentEditable === 'true' ||
           target.isContentEditable;
  }

  /**
   * Get all registered shortcuts for debugging
   */
  getShortcuts() {
    const result = {};
    for (const [key, shortcuts] of this.shortcuts.entries()) {
      result[key] = shortcuts.map(s => ({
        context: s.context,
        priority: s.priority,
        description: s.description
      }));
    }
    return result;
  }

  /**
   * Clear all shortcuts
   */
  clear() {
    this.shortcuts.clear();
    this.contextStack = [];
    this.activeModalOrComponent = null;
  }
}

// Create global instance
const keyboardManager = new KeyboardShortcutManager();

// Auto-start listening
keyboardManager.startListening();

export default keyboardManager;

/**
 * React hook for using keyboard shortcuts
 */
export const useKeyboardShortcut = (key, handler, options = {}) => {
  useEffect(() => {
    const shortcutId = keyboardManager.register(key, handler, options);
    
    return () => {
      keyboardManager.unregister(shortcutId);
    };
  }, [key, handler, options.context, options.priority]);
};

/**
 * React hook for managing component context
 */
export const useShortcutContext = (contextName) => {
  useEffect(() => {
    keyboardManager.pushContext(contextName);
    
    return () => {
      keyboardManager.popContext();
    };
  }, [contextName]);
};

/**
 * Utility functions for common shortcut patterns
 */
export const ShortcutUtils = {
  // Register escape key for modals
  registerEscapeForModal: (handler, contextName = 'modal') => {
    return keyboardManager.register('escape', handler, {
      priority: 'high',
      context: contextName,
      description: 'Close modal/component'
    });
  },

  // Register global navigation shortcuts
  registerGlobalShortcuts: (shortcuts) => {
    const ids = [];
    for (const [key, handler, description] of shortcuts) {
      const id = keyboardManager.register(key, handler, {
        priority: 'normal',
        context: 'global',
        description
      });
      ids.push(id);
    }
    return ids;
  },

  // Register component-specific shortcuts
  registerComponentShortcuts: (shortcuts, contextName) => {
    const ids = [];
    for (const [key, handler, description] of shortcuts) {
      const id = keyboardManager.register(key, handler, {
        priority: 'high',
        context: contextName,
        description
      });
      ids.push(id);
    }
    return ids;
  }
}; 