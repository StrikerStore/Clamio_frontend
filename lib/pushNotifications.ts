/**
 * Push Notification Service for Frontend
 * Handles push notification subscription and management
 */

import { apiClient } from './api';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationData {
  notificationId: number;
  type: string;
  severity: string;
  orderId?: string;
  vendorName?: string;
  url?: string;
}

class PushNotificationService {
  private vapidPublicKey: string | null = null;
  private isSupported: boolean = false;
  private isSubscribed: boolean = false;
  private subscription: PushSubscription | null = null;

  constructor() {
    this.isSupported = this.checkSupport();
    if (this.isSupported) {
      this.initialize();
    }
  }

  /**
   * Check if push notifications are supported
   */
  private checkSupport(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Initialize the push notification service
   */
  private async initialize(): Promise<void> {
    if (!this.isSupported) return;

    try {
      // Get VAPID public key from backend
      const response = await apiClient.getVapidKey();
      if (response.success && response.data && response.data.publicKey) {
        this.vapidPublicKey = response.data.publicKey;
        console.log('🔔 VAPID key received from backend');
      } else {
        console.log('🔔 VAPID key not configured, push notifications will be limited');
        this.vapidPublicKey = null;
      }

      // Check current subscription status
      await this.checkSubscriptionStatus();
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      // Set default values if initialization fails
      this.vapidPublicKey = null;
      this.isSubscribed = false;
    }
  }

  /**
   * Check if user is currently subscribed to push notifications
   */
  async checkSubscriptionStatus(): Promise<boolean> {
    if (!this.isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      this.subscription = subscription;
      this.isSubscribed = !!subscription;

      // Also check with backend
      const response = await apiClient.getPushNotificationStatus();
      if (response.success) {
        this.isSubscribed = response.data.isSubscribed;
      }

      return this.isSubscribed;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported in this browser');
    }

    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<boolean> {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported in this browser');
    }

    if (!this.vapidPublicKey) {
      console.log('🔔 VAPID key not available, enabling browser notifications only');
      // Enable browser notifications without push subscription
      const permission = await this.requestPermission();
      if (permission === 'granted') {
        this.isSubscribed = true;
        return true;
      }
      throw new Error('Notification permission denied');
    }

    try {
      // Request permission first
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      this.subscription = subscription;
      this.isSubscribed = true;

      // Send subscription to backend
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      };

      const response = await apiClient.subscribeToPushNotifications(subscriptionData);
      if (!response.success) {
        throw new Error(response.message || 'Failed to subscribe');
      }

      console.log('✅ Successfully subscribed to push notifications');
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      this.isSubscribed = false;
      this.subscription = null;
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.isSupported || !this.subscription) {
      return true;
    }

    try {
      // Unsubscribe from push manager
      const success = await this.subscription.unsubscribe();
      
      if (success) {
        // Notify backend
        await apiClient.unsubscribeFromPushNotifications();
        
        this.subscription = null;
        this.isSubscribed = false;
        
        console.log('✅ Successfully unsubscribed from push notifications');
      }

      return success;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      throw error;
    }
  }

  /**
   * Update push notification preference
   */
  async updatePreference(enabled: boolean): Promise<boolean> {
    try {
      if (enabled && !this.isSubscribed) {
        // Subscribe if enabling and not already subscribed
        return await this.subscribe();
      } else if (!enabled && this.isSubscribed) {
        // Unsubscribe if disabling
        return await this.unsubscribe();
      }

      // Just update preference in backend
      const response = await apiClient.updatePushNotificationPreference(enabled);
      return response.success;
    } catch (error) {
      console.error('Error updating push notification preference:', error);
      throw error;
    }
  }

  /**
   * Get current subscription status
   */
  getStatus(): {
    isSupported: boolean;
    isSubscribed: boolean;
    permission: NotificationPermission;
  } {
    return {
      isSupported: this.isSupported,
      isSubscribed: this.isSubscribed,
      permission: this.isSupported ? Notification.permission : 'denied'
    };
  }

  /**
   * Show a test notification
   */
  async showTestNotification(): Promise<void> {
    if (!this.isSupported || Notification.permission !== 'granted') {
      throw new Error('Notifications not available');
    }

    const notification = new Notification('Test Notification', {
      body: 'This is a test notification from Clamio Admin Panel',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: 'test-notification',
      requireInteraction: false
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
  }

  /**
   * Handle incoming push notification
   */
  handlePushNotification(event: PushEvent): void {
    console.log('📱 Push notification received:', event);

    if (!event.data) return;

    try {
      const data = event.data.json() as any;
      const notificationData: NotificationData = data.data;

      const options: NotificationOptions = {
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        badge: data.badge || '/icon-72x72.png',
        tag: `notification-${notificationData.notificationId}`,
        data: notificationData,
        requireInteraction: data.requireInteraction || false,
        vibrate: data.vibrate || [200],
        actions: data.actions || []
      };

      // Show notification
      const notification = new Notification(data.title, options);

      // Handle notification click
      notification.onclick = () => {
        event.waitUntil(
          clients.matchAll({ type: 'window' }).then(clientList => {
            // If app is already open, focus it
            for (const client of clientList) {
              if (client.url === window.location.origin && 'focus' in client) {
                return (client as any).focus();
              }
            }
            // Otherwise, open new window
            if (clients.openWindow) {
              const url = notificationData.url || '/admin/orders';
              return clients.openWindow(url);
            }
          })
        );
        notification.close();
      };

      // Handle notification action clicks
      notification.onclick = (event) => {
        if (event.action === 'view') {
          // Open notification details
          const url = notificationData.url || '/admin/orders';
          if (clients.openWindow) {
            clients.openWindow(url);
          }
        } else if (event.action === 'dismiss') {
          // Dismiss notification
          notification.close();
        } else {
          // Default click behavior
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        }
      };

    } catch (error) {
      console.error('Error handling push notification:', error);
    }
  }

  /**
   * Utility: Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Utility: Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
