/**
 * MobileUtils - Street Legacy mobile utilities
 *
 * Re-exports from core with game-specific storage key configured.
 */

// Import and re-export everything from core
export * from '../core/utils/MobileUtils'

// Import MobileSettings to configure the storage key
import { MobileSettings as CoreMobileSettings } from '../core/utils/MobileUtils'

// Configure Street Legacy-specific storage key
CoreMobileSettings.setStorageKey('street_legacy_mobile_settings')

// Re-export the configured MobileSettings
export const MobileSettings = CoreMobileSettings

// Convenience exports for common device checks
import { DeviceCapabilities } from '../core/utils/MobileUtils'

export const isMobile = () => DeviceCapabilities.isMobile()
export const isTablet = () => DeviceCapabilities.isTablet()
export const isTouchDevice = () => DeviceCapabilities.isTouchDevice()
export const getDeviceType = () => {
  if (DeviceCapabilities.isTablet()) return 'tablet'
  if (DeviceCapabilities.isMobile()) return 'mobile'
  return 'desktop'
}
export const getOptimalFontSize = (base) => {
  if (DeviceCapabilities.isSmallScreen()) return Math.max(base - 2, 10)
  return base
}

export default {
  DeviceCapabilities,
  MobileSettings,
  isMobile,
  isTablet,
  isTouchDevice,
  getDeviceType,
  getOptimalFontSize
}
