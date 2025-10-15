/**
 * Vendor Error Tracker for Frontend
 * Automatically tracks and reports errors from vendor operations
 */

import { apiClient } from './api';

export interface ErrorContext {
  component?: string;
  action?: string;
  orderId?: string;
  orderIds?: string[];
  endpoint?: string;
  method?: string;
  statusCode?: number;
  retryCount?: number;
  userAgent?: string;
  url?: string;
}

export interface TrackedError {
  type: string;
  code?: string | number;
  message: string;
  stack?: string;
}

class VendorErrorTracker {
  private vendorId: string | null = null;
  private vendorName: string | null = null;
  private isEnabled: boolean = true;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the error tracker
   */
  private initialize(): void {
    // Get vendor info from localStorage
    if (typeof window !== 'undefined') {
      try {
        const userData = localStorage.getItem('user_data');
        if (userData) {
          const user = JSON.parse(userData);
          this.vendorId = user.id;
          this.vendorName = user.name;
        }
      } catch (error) {
        console.error('Error initializing vendor error tracker:', error);
      }
    }
  }

  /**
   * Enable or disable error tracking
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Update vendor info
   */
  updateVendorInfo(vendorId: string, vendorName: string): void {
    this.vendorId = vendorId;
    this.vendorName = vendorName;
  }

  /**
   * Track an error from vendor operations
   */
  async trackError(
    operation: string,
    error: Error | TrackedError,
    context: ErrorContext = {}
  ): Promise<void> {
    if (!this.isEnabled || !this.vendorId || !this.vendorName) {
      return;
    }

    try {
      const errorData: TrackedError = {
        type: this.getErrorType(error),
        code: this.getErrorCode(error),
        message: error.message,
        stack: error.stack
      };

      const fullContext: ErrorContext = {
        ...context,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      console.log('🔍 Tracking vendor error:', {
        operation,
        error: errorData,
        context: fullContext
      });

      // Create notification via API
      await apiClient.createNotification({
        type: this.getNotificationType(operation, errorData),
        severity: this.getSeverity(operation, errorData),
        title: this.getTitle(operation, errorData, context),
        message: this.getMessage(operation, errorData, context),
        order_id: context.orderId,
        vendor_id: this.vendorId ? parseInt(this.vendorId) : undefined,
        vendor_name: this.vendorName,
        metadata: {
          operation,
          error_type: errorData.type,
          error_code: errorData.code,
          component: context.component,
          action: context.action,
          timestamp: new Date().toISOString()
        },
        error_details: JSON.stringify({
          error: errorData,
          context: fullContext,
          stack_trace: errorData.stack
        }, null, 2)
      });

    } catch (trackingError) {
      console.error('❌ Error tracking vendor error:', trackingError);
      // Don't throw - error tracking should not break the main flow
    }
  }

  /**
   * Track API errors
   */
  async trackApiError(
    operation: string,
    error: any,
    context: ErrorContext = {}
  ): Promise<void> {
    const trackedError: TrackedError = {
      type: 'API_ERROR',
      code: error.code || error.status || error.statusCode,
      message: error.message || 'API request failed',
      stack: error.stack
    };

    await this.trackError(operation, trackedError, {
      ...context,
      endpoint: context.endpoint,
      method: context.method,
      statusCode: error.status || error.statusCode
    });
  }

  /**
   * Track network errors
   */
  async trackNetworkError(
    operation: string,
    error: any,
    context: ErrorContext = {}
  ): Promise<void> {
    const trackedError: TrackedError = {
      type: 'NETWORK_ERROR',
      code: error.code || 'NETWORK_ERROR',
      message: error.message || 'Network request failed',
      stack: error.stack
    };

    await this.trackError(operation, trackedError, {
      ...context,
      retryCount: context.retryCount || 0
    });
  }

  /**
   * Track validation errors
   */
  async trackValidationError(
    operation: string,
    error: any,
    context: ErrorContext = {}
  ): Promise<void> {
    const trackedError: TrackedError = {
      type: 'VALIDATION_ERROR',
      code: error.code || 'VALIDATION_ERROR',
      message: error.message || 'Validation failed',
      stack: error.stack
    };

    await this.trackError(operation, trackedError, context);
  }

  /**
   * Track authentication errors
   */
  async trackAuthError(
    operation: string,
    error: any,
    context: ErrorContext = {}
  ): Promise<void> {
    const trackedError: TrackedError = {
      type: 'AUTHENTICATION_ERROR',
      code: error.code || 'AUTH_ERROR',
      message: error.message || 'Authentication failed',
      stack: error.stack
    };

    await this.trackError(operation, trackedError, context);
  }

  /**
   * Track file operation errors
   */
  async trackFileError(
    operation: string,
    error: any,
    context: ErrorContext = {}
  ): Promise<void> {
    const trackedError: TrackedError = {
      type: 'FILE_ERROR',
      code: error.code || 'FILE_ERROR',
      message: error.message || 'File operation failed',
      stack: error.stack
    };

    await this.trackError(operation, trackedError, context);
  }

  /**
   * Get error type from error object
   */
  private getErrorType(error: Error | TrackedError): string {
    if ('type' in error) {
      return error.type;
    }

    // Infer type from error name or message
    const errorName = (error as Error).name?.toLowerCase() || '';
    const errorMessage = error.message.toLowerCase();

    if (errorName.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('network')) {
      return 'NETWORK_ERROR';
    }

    if (errorName.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      return 'AUTHENTICATION_ERROR';
    }

    if (errorName.includes('validation') || errorMessage.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }

    if (errorName.includes('timeout') || errorMessage.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Get error code from error object
   */
  private getErrorCode(error: Error | TrackedError): string | number | undefined {
    if ('code' in error) {
      return error.code as string | number | undefined;
    }

    // Try to extract code from error message
    const message = error.message;
    const codeMatch = message.match(/code[:\s]+(\w+)/i);
    if (codeMatch) {
      return codeMatch[1];
    }

    return undefined;
  }

  /**
   * Get notification type based on operation and error
   */
  private getNotificationType(operation: string, error: TrackedError): string {
    const operationTypeMap: Record<string, string> = {
      'claim_order': 'order_claim_error',
      'bulk_claim_orders': 'order_claim_error',
      'reverse_order': 'reverse_order_failure',
      'bulk_reverse_orders': 'reverse_order_failure',
      'mark_ready': 'order_processing_error',
      'bulk_mark_ready': 'order_processing_error',
      'download_label': 'label_download_error',
      'bulk_download_labels': 'label_download_error',
      'fetch_orders': 'data_fetch_error',
      'refresh_orders': 'data_refresh_error',
      'fetch_grouped_orders': 'data_fetch_error',
      'fetch_payments': 'data_fetch_error',
      'fetch_settlements': 'data_fetch_error',
      'fetch_transactions': 'data_fetch_error',
      'create_settlement_request': 'settlement_error',
      'upload_payment_proof': 'settlement_error',
      'fetch_address': 'address_error',
      'update_address': 'address_error'
    };

    return operationTypeMap[operation] || 'vendor_operation_error';
  }

  /**
   * Get severity based on operation and error
   */
  private getSeverity(operation: string, error: TrackedError): string {
    // Critical operations
    const criticalOperations = [
      'claim_order', 'bulk_claim_orders', 'reverse_order', 'bulk_reverse_orders'
    ];

    // High severity operations
    const highSeverityOperations = [
      'mark_ready', 'bulk_mark_ready', 'download_label', 'bulk_download_labels'
    ];

    // Critical error types
    const criticalErrorTypes = [
      'NETWORK_ERROR', 'TIMEOUT_ERROR', 'AUTHENTICATION_ERROR', 'PERMISSION_ERROR'
    ];

    const highErrorTypes = [
      'VALIDATION_ERROR', 'FILE_ERROR', 'DATA_ERROR'
    ];

    if (criticalErrorTypes.includes(error.type)) {
      return 'critical';
    }

    if (highErrorTypes.includes(error.type)) {
      return 'high';
    }

    if (criticalOperations.includes(operation)) {
      return 'critical';
    }

    if (highSeverityOperations.includes(operation)) {
      return 'high';
    }

    // Check error message for keywords
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('critical') || errorMessage.includes('fatal')) {
      return 'critical';
    }

    if (errorMessage.includes('failed') || errorMessage.includes('error')) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Create notification title
   */
  private getTitle(operation: string, error: TrackedError, context: ErrorContext): string {
    const operationNames: Record<string, string> = {
      'claim_order': 'Order Claim',
      'bulk_claim_orders': 'Bulk Order Claim',
      'reverse_order': 'Order Reverse',
      'bulk_reverse_orders': 'Bulk Order Reverse',
      'mark_ready': 'Mark Order Ready',
      'bulk_mark_ready': 'Bulk Mark Orders Ready',
      'download_label': 'Label Download',
      'bulk_download_labels': 'Bulk Label Download',
      'fetch_orders': 'Orders Fetch',
      'refresh_orders': 'Orders Refresh',
      'fetch_grouped_orders': 'Grouped Orders Fetch',
      'fetch_payments': 'Payments Fetch',
      'fetch_settlements': 'Settlements Fetch',
      'fetch_transactions': 'Transactions Fetch',
      'create_settlement_request': 'Settlement Request',
      'upload_payment_proof': 'Payment Proof Upload',
      'fetch_address': 'Address Fetch',
      'update_address': 'Address Update'
    };

    const operationName = operationNames[operation] || operation;
    const orderInfo = context.orderId ? ` - Order ${context.orderId}` : '';
    
    return `${operationName} Failed${orderInfo}`;
  }

  /**
   * Create notification message
   */
  private getMessage(operation: string, error: TrackedError, context: ErrorContext): string {
    const operationNames: Record<string, string> = {
      'claim_order': 'order claim',
      'bulk_claim_orders': 'bulk order claim',
      'reverse_order': 'order reverse',
      'bulk_reverse_orders': 'bulk order reverse',
      'mark_ready': 'mark order ready',
      'bulk_mark_ready': 'bulk mark orders ready',
      'download_label': 'label download',
      'bulk_download_labels': 'bulk label download',
      'fetch_orders': 'orders fetch',
      'refresh_orders': 'orders refresh',
      'fetch_grouped_orders': 'grouped orders fetch',
      'fetch_payments': 'payments fetch',
      'fetch_settlements': 'settlements fetch',
      'fetch_transactions': 'transactions fetch',
      'create_settlement_request': 'settlement request creation',
      'upload_payment_proof': 'payment proof upload',
      'fetch_address': 'address fetch',
      'update_address': 'address update'
    };

    const operationName = operationNames[operation] || operation;
    
    let message = `Vendor encountered an error during ${operationName}`;
    
    if (context.orderId) {
      message += ` for order ${context.orderId}`;
    }
    
    message += `. Error: ${error.message}`;

    return message;
  }

  /**
   * Create a wrapper function for API calls that automatically tracks errors
   */
  createTrackedApiCall<T extends any[], R>(
    operation: string,
    apiFunction: (...args: T) => Promise<R>,
    context: ErrorContext = {}
  ) {
    return async (...args: T): Promise<R> => {
      try {
        return await apiFunction(...args);
      } catch (error) {
        await this.trackApiError(operation, error, context);
        throw error; // Re-throw the error after tracking
      }
    };
  }
}

// Export singleton instance
export const vendorErrorTracker = new VendorErrorTracker();
