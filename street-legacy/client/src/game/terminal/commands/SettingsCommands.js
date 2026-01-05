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
  commandRegistry.register({
    name: 'settings',
    help: 'Show or modify terminal settings',
    usage: 'settings [category] [option] [value]',
    category: 'system',
    handler: async ({ args }) => {
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
          return { error: true, message: `Unknown setting category: ${category}` }
      }
    }
  })

  // ============================================
  // THEME COMMAND
  // ============================================
  commandRegistry.register({
    name: 'theme',
    help: 'Change terminal theme',
    usage: 'theme [name]',
    category: 'system',
    handler: async ({ args }) => {
      if (args.length === 0 || args[0] === 'current') {
        return { output: themeManager.formatCurrentTheme() }
      }

      if (args[0] === 'list') {
        const themes = themeManager.getThemeList()
        const lines = ['Available Themes:', '']
        themes.forEach(t => {
          const current = themeManager.getCurrentTheme().key === t.key ? ' [current]' : ''
          lines.push(`  ${t.key}${current}`)
          lines.push(`    ${t.description}`)
        })
        return { output: lines.join('\n') }
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
  commandRegistry.register({
    name: 'vim',
    help: 'Toggle or configure vim mode',
    usage: 'vim [on|off|status]',
    category: 'system',
    handler: async ({ args }) => {
      if (args.length === 0 || args[0] === 'status') {
        const stats = vimModeManager.getStats()
        return {
          output: [
            `Vim Mode: ${stats.enabled ? 'ENABLED' : 'DISABLED'}`,
            stats.enabled ? `Current Mode: ${stats.currentMode}` : '',
            '',
            'Use "vim on" to enable, "vim off" to disable'
          ].filter(Boolean).join('\n')
        }
      }

      if (args[0] === 'on' || args[0] === 'enable') {
        vimModeManager.enable()
        return { output: 'Vim mode enabled. Press Escape for NORMAL mode, i for INSERT mode.' }
      }

      if (args[0] === 'off' || args[0] === 'disable') {
        vimModeManager.disable()
        return { output: 'Vim mode disabled.' }
      }

      return { error: true, message: 'Usage: vim [on|off|status]' }
    }
  })

  // ============================================
  // MACRO COMMAND
  // ============================================
  commandRegistry.register({
    name: 'macro',
    help: 'Manage command macros',
    usage: 'macro <subcommand> [args]',
    category: 'system',
    handler: async ({ args }) => {
      if (args.length === 0) {
        return { output: macroManager.formatMacroList() }
      }

      const subcommand = args[0].toLowerCase()

      switch (subcommand) {
        case 'list':
          return { output: macroManager.formatMacroList() }

        case 'record':
          if (!args[1]) {
            return { error: true, message: 'Usage: macro record <name>' }
          }
          return macroManager.startRecording(args[1])

        case 'stop':
          return macroManager.stopRecording()

        case 'run':
          if (!args[1]) {
            return { error: true, message: 'Usage: macro run <name> [args...]' }
          }
          return macroManager.runMacro(args[1], args.slice(2))

        case 'define':
          if (!args[1] || !args[2]) {
            return { error: true, message: 'Usage: macro define <name> "<commands>"' }
          }
          // Join and remove surrounding quotes
          let commands = args.slice(2).join(' ')
          commands = commands.replace(/^["']|["']$/g, '')
          return macroManager.defineMacro(args[1], commands)

        case 'bind':
          if (!args[1] || !args[2]) {
            return { error: true, message: 'Usage: macro bind <key> <macro_name>' }
          }
          return macroManager.bindKey(args[1], args[2])

        case 'unbind':
          if (!args[1]) {
            return { error: true, message: 'Usage: macro unbind <key>' }
          }
          return macroManager.unbindKey(args[1])

        case 'delete':
        case 'remove':
          if (!args[1]) {
            return { error: true, message: 'Usage: macro delete <name>' }
          }
          return macroManager.deleteMacro(args[1])

        case 'show':
          if (!args[1]) {
            return { error: true, message: 'Usage: macro show <name>' }
          }
          return { output: macroManager.formatMacroDetails(args[1]) }

        default:
          return { error: true, message: `Unknown macro subcommand: ${subcommand}` }
      }
    }
  })

  // ============================================
  // UNDO COMMAND
  // ============================================
  commandRegistry.register({
    name: 'undo',
    help: 'Undo last action(s)',
    usage: 'undo [count]',
    category: 'system',
    handler: async ({ args }) => {
      const count = parseInt(args[0]) || 1
      return undoManager.undo(count)
    }
  })

  // ============================================
  // REDO COMMAND
  // ============================================
  commandRegistry.register({
    name: 'redo',
    help: 'Redo last undone action(s)',
    usage: 'redo [count]',
    category: 'system',
    handler: async ({ args }) => {
      const count = parseInt(args[0]) || 1
      return undoManager.redo(count)
    }
  })

  // ============================================
  // HISTORY COMMAND
  // ============================================
  commandRegistry.register({
    name: 'history',
    help: 'Show command/action history',
    usage: 'history [count]',
    category: 'system',
    handler: async ({ args }) => {
      const count = parseInt(args[0]) || 20
      return { output: undoManager.formatHistory(count) }
    }
  })

  // ============================================
  // PIPE COMMAND (help for pipe filters)
  // ============================================
  commandRegistry.register({
    name: 'pipe',
    help: 'Show available pipe filters',
    usage: 'pipe',
    category: 'system',
    handler: async () => {
      return { output: commandChainExecutor.getFilterHelp() }
    }
  })

  // ============================================
  // ALIAS for common settings
  // ============================================
  commandRegistry.register({
    name: 'font',
    help: 'Set terminal font size',
    usage: 'font <size>',
    category: 'system',
    handler: async ({ args }) => {
      if (!args[0]) {
        const font = themeManager.getFont()
        return { output: `Current font size: ${font.size}px` }
      }
      return themeManager.setFontSize(args[0])
    }
  })

  commandRegistry.register({
    name: 'effects',
    help: 'Toggle visual effects',
    usage: 'effects [on|off]',
    category: 'system',
    handler: async ({ args }) => {
      if (!args[0]) {
        const effects = themeManager.getEffects()
        const lines = ['Visual Effects:', '']
        Object.entries(effects).forEach(([key, value]) => {
          lines.push(`  ${key}: ${value}`)
        })
        return { output: lines.join('\n') }
      }

      const enabled = args[0] === 'on' || args[0] === 'true'
      themeManager.setEffect('scanlines', enabled)
      themeManager.setEffect('glow', enabled)
      return { output: `Visual effects ${enabled ? 'enabled' : 'disabled'}` }
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

  return { output: lines.join('\n') }
}

function handleThemeSetting(themeName, value) {
  if (!themeName) {
    return { output: themeManager.formatCurrentTheme() }
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
    return { output: `Current font size: ${font.size}px` }
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
    return { output: lines.join('\n') }
  }

  return themeManager.setEffect(effect, value)
}

function handleVimSetting(option) {
  if (!option) {
    return { output: `Vim mode: ${vimModeManager.isEnabled() ? 'enabled' : 'disabled'}` }
  }

  if (option === 'on' || option === 'enable') {
    vimModeManager.enable()
    return { output: 'Vim mode enabled' }
  }

  if (option === 'off' || option === 'disable') {
    vimModeManager.disable()
    return { output: 'Vim mode disabled' }
  }

  return { error: true, message: 'Usage: settings vim [on|off]' }
}

function resetSettings() {
  themeManager.resetToDefault()
  vimModeManager.disable()
  return { output: 'All settings reset to defaults' }
}

export default { registerSettingsCommands }
