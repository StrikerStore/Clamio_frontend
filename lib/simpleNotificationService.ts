/**
 * Simple Notification Service
 * Shows browser notifications without requiring VAPID keys
 */

export interface SimpleNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
}

class SimpleNotificationService {
  private isSupported: boolean = false;
  private isEnabled: boolean = false;

  constructor() {
    this.isSupported = this.checkSupport();
    console.log('🔔 Simple Notification Service initialized');
  }

  /**
   * Check if notifications are supported
   */
  private checkSupport(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window
    );
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    this.isEnabled = permission === 'granted';
    console.log('Notification permission:', permission);
    return permission;
  }

  /**
   * Check current permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported) return 'denied';
    return Notification.permission;
  }

  /**
   * Show a notification
   */
  async showNotification(notification: SimpleNotification): Promise<void> {
    if (!this.isSupported || !this.isEnabled) {
      console.log('Notifications not available or not enabled');
      return;
    }

    const options: NotificationOptions = {
      body: notification.body,
      icon: notification.icon || '/icon-192x192.png',
      badge: notification.badge || '/icon-72x72.png',
      tag: notification.tag,
      data: notification.data,
      requireInteraction: false,
      silent: false
    };

    const notif = new Notification(notification.title, options);

    // Auto-close after 5 seconds
    setTimeout(() => {
      notif.close();
    }, 5000);

    // Handle click
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  }

  /**
   * Show a test notification
   */
  async showTestNotification(): Promise<void> {
    await this.showNotification({
      title: 'Test Notification',
      body: 'This is a test notification from Clamio Admin Panel',
      tag: 'test-notification'
    });
  }

  /**
   * Show notification for vendor error
   */
  async showVendorErrorNotification(errorData: {
    title: string;
    message: string;
    severity: string;
    orderId?: string;
    vendorName?: string;
  }): Promise<void> {
    const icon = errorData.severity === 'critical' ? '/icon-192x192.png' : '/icon-192x192.png';
    
    await this.showNotification({
      title: errorData.title,
      body: errorData.message,
      icon,
      tag: `vendor-error-${Date.now()}`,
      data: {
        type: 'vendor_error',
        severity: errorData.severity,
        orderId: errorData.orderId,
        vendorName: errorData.vendorName
      }
    });
  }

  /**
   * Enable notifications
   */
  async enable(): Promise<boolean> {
    const permission = await this.requestPermission();
    this.isEnabled = permission === 'granted';
    return this.isEnabled;
  }

  /**
   * Disable notifications
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Get status
   */
  getStatus(): {
    isSupported: boolean;
    isEnabled: boolean;
    permission: NotificationPermission;
  } {
    return {
      isSupported: this.isSupported,
      isEnabled: this.isEnabled,
      permission: this.getPermissionStatus()
    };
  }
}

// Export singleton instance
export const simpleNotificationService = new SimpleNotificationService();
