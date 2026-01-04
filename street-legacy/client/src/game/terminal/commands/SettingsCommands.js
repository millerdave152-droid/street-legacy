/**
 * SettingsCommands - Terminal Commands for Settings/Power User Features
 *
 * Commands:
 * - settings: Show/modify settings
 * - theme: Change terminal theme
 * - vim: Toggle vim mode
 * - macro: Macro management
 * - undo/redo: Undo/redo actions
 * - history: Command history
 * - pipe: Show pipe filter help
 */

import { commandRegistry } from '../CommandRegistry'
import { themeManager } from '../ThemeManager'
import { vimModeManager } from '../VimModeManager'
import { macroManager } from '../MacroManager'
import { undoManager } from '../UndoManager'
import { commandChainExecutor } from '../CommandChainExecutor'

/**
 * Register all settings commands
 */
export function registerSettingsCommands() {
  // ============================================
  // SETTINGS COMMAND
  // ============================================
  commandRegistry.register('settings', {
    description: 'Show or modify terminal settings',
    usage: 'settings [category] [option] [value]',
    examples: [
      'settings',
      'settings theme',
      'settings theme cyberpunk',
      'settings font 12',
      'settings effects scanlines off'
    ],
    category: 'system',
    handler: async (args) => {
      if (args.length === 0) {
        return showAllSettings()
      }

      const category = args[0].toLowerCase()
      const option = args[1]
      const value = args.slice(2).join(' ') || args[2]

      switch (category) {
        case 'theme':
          return handleThemeSetting(option, value)
        case 'font':
          return handleFontSetting(option)
        case 'effects':
          return handleEffectsSetting(option, value)
        case 'vim':
          return handleVimSetting(option)
        case 'reset':
          return resetSettings()
        default:
          return { success: false, message: `Unknown setting category: ${category}` }
      }
    }
  })

  // ============================================
  // THEME COMMAND
  // ============================================
  commandRegistry.register('theme', {
    description: 'Change terminal theme',
    usage: 'theme [name]',
    examples: [
      'theme',
      'theme list',
      'theme cyberpunk',
      'theme matrix',
      'theme reset'
    ],
    category: 'system',
    handler: async (args) => {
      if (args.length === 0 || args[0] === 'current') {
        return { success: true, message: themeManager.formatCurrentTheme() }
      }

      if (args[0] === 'list') {
        const themes = themeManager.getThemeList()
        const lines = ['Available Themes:', '']
        themes.forEach(t => {
          const current = themeManager.getCurrentTheme().key === t.key ? ' [current]' : ''
          lines.push(`  ${t.key}${current}`)
          lines.push(`    ${t.description}`)
        })
        return { success: true, message: lines.join('\n') }
      }

      if (args[0] === 'reset') {
        return themeManager.resetToDefault()
      }

      return themeManager.setTheme(args.join(' '))
    }
  })

  // ============================================
  // VIM COMMAND
  // ============================================
  commandRegistry.register('vim', {
    description: 'Toggle or configure vim mode',
    usage: 'vim [on|off|status]',
    examples: [
      'vim',
      'vim on',
      'vim off',
      'vim status'
    ],
    category: 'system',
    handler: async (args) => {
      if (args.length === 0 || args[0] === 'status') {
        const stats = vimModeManager.getStats()
        return {
          success: true,
          message: [
            `Vim Mode: ${stats.enabled ? 'ENABLED' : 'DISABLED'}`,
            stats.enabled ? `Current Mode: ${stats.currentMode}` : '',
            '',
            'Use "vim on" to enable, "vim off" to disable'
          ].filter(Boolean).join('\n')
        }
      }

      if (args[0] === 'on' || args[0] === 'enable') {
        vimModeManager.enable()
        return { success: true, message: 'Vim mode enabled. Press Escape for NORMAL mode, i for INSERT mode.' }
      }

      if (args[0] === 'off' || args[0] === 'disable') {
        vimModeManager.disable()
        return { success: true, message: 'Vim mode disabled.' }
      }

      return { success: false, message: 'Usage: vim [on|off|status]' }
    }
  })

  // ============================================
  // MACRO COMMAND
  // ============================================
  commandRegistry.register('macro', {
    description: 'Manage command macros',
    usage: 'macro <subcommand> [args]',
    examples: [
      'macro list',
      'macro record myjob',
      'macro stop',
      'macro run myjob',
      'macro define grind "crime && status"',
      'macro bind Ctrl+1 grind',
      'macro delete myjob'
    ],
    category: 'system',
    handler: async (args) => {
      if (args.length === 0) {
        return { success: true, message: macroManager.formatMacroList() }
      }

      const subcommand = args[0].toLowerCase()

      switch (subcommand) {
        case 'list':
          return { success: true, message: macroManager.formatMacroList() }

        case 'record':
          if (!args[1]) {
            return { success: false, message: 'Usage: macro record <name>' }
          }
          return macroManager.startRecording(args[1])

        case 'stop':
          return macroManager.stopRecording()

        case 'run':
          if (!args[1]) {
            return { success: false, message: 'Usage: macro run <name> [args...]' }
          }
          return macroManager.runMacro(args[1], args.slice(2))

        case 'define':
          if (!args[1] || !args[2]) {
            return { success: false, message: 'Usage: macro define <name> "<commands>"' }
          }
          // Join and remove surrounding quotes
          let commands = args.slice(2).join(' ')
          commands = commands.replace(/^["']|["']$/g, '')
          return macroManager.defineMacro(args[1], commands)

        case 'bind':
          if (!args[1] || !args[2]) {
            return { success: false, message: 'Usage: macro bind <key> <macro_name>' }
          }
          return macroManager.bindKey(args[1], args[2])

        case 'unbind':
          if (!args[1]) {
            return { success: false, message: 'Usage: macro unbind <key>' }
          }
          return macroManager.unbindKey(args[1])

        case 'delete':
        case 'remove':
          if (!args[1]) {
            return { success: false, message: 'Usage: macro delete <name>' }
          }
          return macroManager.deleteMacro(args[1])

        case 'show':
          if (!args[1]) {
            return { success: false, message: 'Usage: macro show <name>' }
          }
          return { success: true, message: macroManager.formatMacroDetails(args[1]) }

        default:
          return { success: false, message: `Unknown macro subcommand: ${subcommand}` }
      }
    }
  })

  // ============================================
  // UNDO COMMAND
  // ============================================
  commandRegistry.register('undo', {
    description: 'Undo last action(s)',
    usage: 'undo [count]',
    examples: [
      'undo',
      'undo 3'
    ],
    category: 'system',
    handler: async (args) => {
      const count = parseInt(args[0]) || 1
      return undoManager.undo(count)
    }
  })

  // ============================================
  // REDO COMMAND
  // ============================================
  commandRegistry.register('redo', {
    description: 'Redo last undone action(s)',
    usage: 'redo [count]',
    examples: [
      'redo',
      'redo 2'
    ],
    category: 'system',
    handler: async (args) => {
      const count = parseInt(args[0]) || 1
      return undoManager.redo(count)
    }
  })

  // ============================================
  // HISTORY COMMAND
  // ============================================
  commandRegistry.register('history', {
    description: 'Show command/action history',
    usage: 'history [count]',
    examples: [
      'history',
      'history 50'
    ],
    category: 'system',
    handler: async (args) => {
      const count = parseInt(args[0]) || 20
      return { success: true, message: undoManager.formatHistory(count) }
    }
  })

  // ============================================
  // PIPE COMMAND (help for pipe filters)
  // ============================================
  commandRegistry.register('pipe', {
    description: 'Show available pipe filters',
    usage: 'pipe',
    examples: [
      'pipe',
      'status | grep cash',
      'contacts | head 5'
    ],
    category: 'system',
    handler: async () => {
      return { success: true, message: commandChainExecutor.getFilterHelp() }
    }
  })

  // ============================================
  // ALIAS for common settings
  // ============================================
  commandRegistry.register('font', {
    description: 'Set terminal font size',
    usage: 'font <size>',
    examples: ['font 12', 'font 11'],
    category: 'system',
    handler: async (args) => {
      if (!args[0]) {
        const font = themeManager.getFont()
        return { success: true, message: `Current font size: ${font.size}px` }
      }
      return themeManager.setFontSize(args[0])
    }
  })

  commandRegistry.register('effects', {
    description: 'Toggle visual effects',
    usage: 'effects [on|off]',
    examples: ['effects', 'effects off', 'effects on'],
    category: 'system',
    handler: async (args) => {
      if (!args[0]) {
        const effects = themeManager.getEffects()
        const lines = ['Visual Effects:', '']
        Object.entries(effects).forEach(([key, value]) => {
          lines.push(`  ${key}: ${value}`)
        })
        return { success: true, message: lines.join('\n') }
      }

      const enabled = args[0] === 'on' || args[0] === 'true'
      themeManager.setEffect('scanlines', enabled)
      themeManager.setEffect('glow', enabled)
      return { success: true, message: `Visual effects ${enabled ? 'enabled' : 'disabled'}` }
    }
  })
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function showAllSettings() {
  const theme = themeManager.getCurrentTheme()
  const vim = vimModeManager.getStats()
  const macros = macroManager.getStats()
  const undo = undoManager.getStats()

  const lines = [
    '=== Terminal Settings ===',
    '',
    `Theme: ${theme.name}`,
    `Font Size: ${theme.font.size}px`,
    `Scanlines: ${theme.effects.scanlines ? 'on' : 'off'}`,
    `Glow: ${theme.effects.glow ? 'on' : 'off'}`,
    '',
    `Vim Mode: ${vim.enabled ? 'enabled' : 'disabled'}`,
    `Macros: ${macros.macroCount} defined`,
    `Undo Stack: ${undo.undoCount} action(s)`,
    '',
    'Commands:',
    '  settings theme <name>  - Change theme',
    '  settings font <size>   - Change font size',
    '  settings effects <opt> - Toggle effects',
    '  settings vim <on|off>  - Toggle vim mode',
    '  settings reset         - Reset to defaults'
  ]

  return { success: true, message: lines.join('\n') }
}

function handleThemeSetting(themeName, value) {
  if (!themeName) {
    return { success: true, message: themeManager.formatCurrentTheme() }
  }

  // Check if it's a color setting
  if (themeName === 'color' && value) {
    const [colorKey, colorValue] = value.split(' ')
    return themeManager.setColor(colorKey, colorValue)
  }

  return themeManager.setTheme(themeName)
}

function handleFontSetting(size) {
  if (!size) {
    const font = themeManager.getFont()
    return { success: true, message: `Current font size: ${font.size}px` }
  }
  return themeManager.setFontSize(size)
}

function handleEffectsSetting(effect, value) {
  if (!effect) {
    const effects = themeManager.getEffects()
    const lines = ['Visual Effects:']
    Object.entries(effects).forEach(([key, val]) => {
      lines.push(`  ${key}: ${val}`)
    })
    return { success: true, message: lines.join('\n') }
  }

  return themeManager.setEffect(effect, value)
}

function handleVimSetting(option) {
  if (!option) {
    return { success: true, message: `Vim mode: ${vimModeManager.isEnabled() ? 'enabled' : 'disabled'}` }
  }

  if (option === 'on' || option === 'enable') {
    vimModeManager.enable()
    return { success: true, message: 'Vim mode enabled' }
  }

  if (option === 'off' || option === 'disable') {
    vimModeManager.disable()
    return { success: true, message: 'Vim mode disabled' }
  }

  return { success: false, message: 'Usage: settings vim [on|off]' }
}

function resetSettings() {
  themeManager.resetToDefault()
  vimModeManager.disable()
  return { success: true, message: 'All settings reset to defaults' }
}

export default { registerSettingsCommands }
