/**
 * Notification Dialog Component
 * Replaces the tab-based notification system with a faster dialog
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Filter, Search, RefreshCw, Settings, Volume2, VolumeX, CheckCircle, Clock, AlertTriangle, Info, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { pushNotificationService } from '@/lib/pushNotifications';
import { simpleNotificationService } from '@/lib/simpleNotificationService';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  order_id?: string;
  vendor_name?: string;
  vendor_warehouse_id?: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  metadata?: any;
  error_details?: string;
}

interface NotificationStats {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  dismissed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  last_24h: number;
  last_7days: number;
}

interface PushNotificationStats {
  total_admins: number;
  enabled_admins: number;
  subscribed_admins: number;
  active_admins: number;
}

interface NotificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notificationStats?: NotificationStats;
  onNotificationUpdate?: () => void;
}

export function NotificationDialog({ 
  isOpen, 
  onClose, 
  notificationStats, 
  onNotificationUpdate 
}: NotificationDialogProps) {
  const { toast } = useToast();
  
  // State management
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, totalItems: 0 });
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    severity: 'all',
    search: ''
  });
  
  // Push notification state
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Load notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20
      };

      if (filters.status !== 'all') params.status = filters.status;
      if (filters.type !== 'all') params.type = filters.type;
      if (filters.severity !== 'all') params.severity = filters.severity;
      if (filters.search) params.search = filters.search;

      const response = await apiClient.getNotifications(params);
      
      if (response.success && response.data) {
        setNotifications(response.data.notifications || []);
        setPagination({
          totalPages: response.data.pagination?.pages || 1,
          totalItems: response.data.pagination?.total || 0
        });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to fetch notifications",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [page, filters, toast]);

  // Load push notification status
  const loadPushStatus = useCallback(async () => {
    try {
      console.log('🔔 Loading push notification status...');
      
      // Check browser support first
      const isSupported = 'Notification' in window;
      setPushSupported(isSupported);
      
      if (!isSupported) {
        console.log('🔔 Notifications not supported in this browser');
        setPushEnabled(false);
        setPushSubscribed(false);
        setPushPermission('denied');
        return;
      }
      
      // Get current browser permission
      const browserPermission = Notification.permission;
      setPushPermission(browserPermission);
      console.log('🔔 Browser permission:', browserPermission);
      
      // Try to get subscription status from backend
      let backendSubscribed = false;
      try {
        const response = await apiClient.getPushNotificationStatus();
        if (response.success) {
          backendSubscribed = response.data.isSubscribed;
          console.log('🔔 Backend subscription status:', backendSubscribed);
        }
      } catch (apiError: any) {
        console.log('🔔 Backend status not available:', apiError.message);
        // Don't set backendSubscribed to false here - let browser permission take precedence
      }
      
      // Determine final state based on browser permission
      if (browserPermission === 'granted') {
        // Browser permission is granted - notifications should be enabled
        setPushEnabled(true);
        setPushSubscribed(true);
        console.log('🔔 Notifications enabled (browser permission granted)');
      } else if (browserPermission === 'denied') {
        // Browser permission is denied - notifications should be disabled
        setPushEnabled(false);
        setPushSubscribed(false);
        console.log('🔔 Notifications disabled (browser permission denied)');
      } else {
        // Default state - permission not requested yet
        setPushEnabled(false);
        setPushSubscribed(false);
        console.log('🔔 Notifications disabled (permission not requested)');
      }
      
    } catch (error) {
      console.error('❌ Error loading push status:', error);
      // Set safe defaults on error
      setPushEnabled(false);
      setPushSubscribed(false);
      setPushPermission('denied');
    }
  }, []);

  // Subscribe to push notifications
  const handlePushSubscribe = async () => {
    try {
      console.log('🔔 Attempting to enable notifications...');
      
      // Check if browser supports notifications
      if (!('Notification' in window)) {
        throw new Error('This browser does not support notifications');
      }

      // Check current permission first
      const currentPermission = Notification.permission;
      console.log('🔔 Current permission:', currentPermission);
      
      if (currentPermission === 'denied') {
        throw new Error('Notification permission was denied. Please enable notifications in your browser settings.');
      }

      // Try push notifications first (proper database subscription)
      try {
        console.log('🔔 Attempting to subscribe to push notifications...');
        const success = await pushNotificationService.subscribe();
        
        if (success) {
          setPushSubscribed(true);
          setPushEnabled(true);
          toast({
            title: "Success",
            description: "Push notifications enabled successfully",
          });
          console.log('✅ Push notifications enabled successfully');
          return;
        }
      } catch (pushError: any) {
        console.log('🔔 Push notifications failed, falling back to simple notifications:', pushError.message);
        
        // Fallback to simple notifications (works without VAPID keys)
        console.log('🔔 Requesting browser notification permission...');
        const enabled = await simpleNotificationService.enable();
        
        if (enabled) {
          setPushSubscribed(true);
          setPushEnabled(true);
          toast({
            title: "Success",
            description: "Browser notifications enabled successfully (Push notifications not available)",
          });
          console.log('✅ Browser notifications enabled successfully');
          return;
        } else {
          throw new Error('Notification permission denied by user');
        }
      }
      
    } catch (error: any) {
      console.error('❌ Error enabling notifications:', error);
      
      // Reset state on error to prevent toggle from getting stuck
      setPushSubscribed(false);
      setPushEnabled(false);
      
      let errorMessage = error.message || "Failed to enable notifications";
      
      // Provide more helpful error messages
      if (error.message.includes('denied')) {
        errorMessage = "Notification permission was denied. Please enable notifications in your browser settings.";
      } else if (error.message.includes('not supported')) {
        errorMessage = "Your browser does not support notifications. Please use a modern browser like Chrome, Firefox, or Safari.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  // Unsubscribe from push notifications
  const handlePushUnsubscribe = async () => {
    try {
      // Try push notifications first (proper database unsubscription)
      try {
        await pushNotificationService.unsubscribe();
        console.log('✅ Push notifications unsubscribed successfully');
      } catch (pushError: any) {
        console.log('🔔 Push notifications not available, disabling simple notifications:', pushError.message);
      }

      // Disable simple notifications
      simpleNotificationService.disable();
      setPushSubscribed(false);
      setPushEnabled(false);
      toast({
        title: "Success",
        description: "Notifications disabled successfully",
      });
    } catch (error: any) {
      console.error('Error disabling notifications:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to disable notifications",
        variant: "destructive"
      });
    }
  };

  // Test push notification
  const handleTestNotification = async () => {
    try {
      console.log('🧪 Sending test notification...');
      
      // Check if notifications are enabled
      if (!pushSubscribed && !pushEnabled) {
        throw new Error('Notifications are not enabled. Please enable notifications first.');
      }

      // Check browser permission first
      if (Notification.permission !== 'granted') {
        throw new Error('Notification permission is not granted. Please enable notifications first.');
      }

      // Try push notifications first (if available)
      try {
        await pushNotificationService.showTestNotification();
        toast({
          title: "Success",
          description: "Test push notification sent successfully!",
        });
        console.log('✅ Test push notification sent successfully');
        return;
      } catch (pushError: any) {
        console.log('🔔 Push notifications not available, using simple notifications:', pushError.message);
      }

      // Fallback to simple notifications (works without VAPID keys)
      await simpleNotificationService.showTestNotification();
      toast({
        title: "Success",
        description: "Test notification sent successfully!",
      });
      console.log('✅ Test notification sent successfully');
      
    } catch (error: any) {
      console.error('❌ Error sending test notification:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send test notification",
        variant: "destructive"
      });
    }
  };

  // Resolve notification
  const handleResolveNotification = async (notificationId: number) => {
    try {
      await apiClient.resolveNotification(notificationId, resolutionNotes);
      toast({
        title: "Success",
        description: "Notification resolved successfully",
      });
      setResolutionNotes('');
      setSelectedNotification(null);
      fetchNotifications();
      onNotificationUpdate?.();
    } catch (error) {
      console.error('Error resolving notification:', error);
      toast({
        title: "Error",
        description: "Failed to resolve notification",
        variant: "destructive"
      });
    }
  };

  // Dismiss notification
  const handleDismissNotification = async (notificationId: number) => {
    try {
      await apiClient.dismissNotification(notificationId, 'Dismissed by admin');
      toast({
        title: "Success",
        description: "Notification dismissed successfully",
      });
      fetchNotifications();
      onNotificationUpdate?.();
    } catch (error) {
      console.error('Error dismissing notification:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss notification",
        variant: "destructive"
      });
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'medium': return <Info className="w-4 h-4 text-yellow-500" />;
      case 'low': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'dismissed': return <X className="w-4 h-4 text-gray-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get status color for row background
  const getStatusRowColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 border-l-4 border-l-yellow-400 hover:bg-yellow-100';
      case 'in_progress': return 'bg-blue-50 border-l-4 border-l-blue-400 hover:bg-blue-100';
      case 'resolved': return 'bg-green-50 border-l-4 border-l-green-400 hover:bg-green-100';
      case 'dismissed': return 'bg-gray-50 border-l-4 border-l-gray-400 hover:bg-gray-100';
      default: return 'bg-white border-l-4 border-l-gray-300 hover:bg-gray-50';
    }
  };

  // Load data on mount and when filters change
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      loadPushStatus();
    } else {
      // Reset state when dialog is closed to prevent stale state
      setPushEnabled(false);
      setPushSubscribed(false);
      setPushPermission('default');
    }
  }, [isOpen, fetchNotifications, loadPushStatus]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] sm:w-full p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
              {notificationStats && notificationStats.pending > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {notificationStats.pending}
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchNotifications}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {showSettings ? (
            /* Push Settings View */
            <div className="h-full px-6 pb-6">
              <div className="mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(false)}
                  className="flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Back to Notifications
                </Button>
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {pushSupported ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                      Push Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!pushSupported ? (
                      <div className="text-center py-8">
                        <VolumeX className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600">Push notifications are not supported in this browser</p>
                      </div>
                    ) : (
                      <>
                        <div className="text-center py-4 bg-blue-50 rounded-lg mb-4">
                          <Bell className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                          <h4 className="font-medium text-blue-900">Real-time Notifications</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Get instant alerts for vendor errors and critical issues
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">Enable Browser Notifications</h4>
                            <p className="text-sm text-gray-600">
                              Show notifications when new issues occur
                            </p>
                          </div>
                          <Switch
                            checked={pushSubscribed}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handlePushSubscribe();
                              } else {
                                handlePushUnsubscribe();
                              }
                            }}
                          />
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Permission Status:</span>
                            <Badge variant={pushPermission === 'granted' ? 'default' : 'secondary'}>
                              {pushPermission}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Notification Status:</span>
                            <Badge variant={pushSubscribed ? 'default' : 'secondary'}>
                              {pushSubscribed ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-600">
                            <strong>Note:</strong> Notifications will appear in your browser and can be viewed in the notification panel above. 
                            For push notifications on mobile devices, VAPID keys need to be configured on the server.
                          </p>
                        </div>

                        {pushSubscribed && (
                          <>
                            <Separator />
                            <Button
                              variant="outline"
                              onClick={handleTestNotification}
                              className="w-full"
                            >
                              Send Test Notification
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            /* Notifications View */
            <div className="h-full px-3 pb-4">
              {/* Filters */}
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Status</label>
                    <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="dismissed">Dismissed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Severity</label>
                    <Select value={filters.severity} onValueChange={(value) => setFilters({...filters, severity: value})}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severity</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="text-sm font-medium mb-1 block">Search</label>
                    <Input
                      placeholder="Search notifications..."
                      value={filters.search}
                      onChange={(e) => setFilters({...filters, search: e.target.value})}
                      className="h-9"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                    <Button 
                      variant="outline" 
                      onClick={() => setFilters({ status: 'all', type: 'all', severity: 'all', search: '' })}
                      className="w-full h-9"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              )}

              {/* Notifications List */}
              <ScrollArea className="h-[400px] sm:h-[500px]">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    No notifications found
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {notifications.map((notification) => (
                      <Card 
                        key={notification.id} 
                        className={`cursor-pointer hover:shadow-md transition-all duration-200 ${getStatusRowColor(notification.status)}`}
                        onClick={() => {
                          if (notification.status === 'pending') {
                            setSelectedNotification(notification);
                          }
                        }}
                      >
                        <CardContent className="p-1.5">
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-2">
                              <div className="flex-shrink-0 mt-0.5">
                                {getSeverityIcon(notification.severity)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm break-words leading-tight">{notification.title}</h4>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={`text-xs px-1.5 py-0.5 ${getSeverityColor(notification.severity)}`}>
                                  {notification.severity}
                                </Badge>
                                <div className="flex items-center gap-1">
                                  {getStatusIcon(notification.status)}
                                  <span className="text-xs text-gray-500 capitalize">
                                    {notification.status.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {notification.status === 'pending' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedNotification(notification);
                                      }}
                                      className="text-blue-600 hover:text-blue-700 p-1 h-5 w-5"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDismissNotification(notification.id);
                                      }}
                                      className="text-red-600 hover:text-red-700 p-1 h-5 w-5"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 pt-3 border-t">
                  <div className="text-sm text-gray-500 text-center sm:text-left">
                    Showing {notifications.length} of {pagination.totalItems} notifications
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="h-8 px-3"
                    >
                      Previous
                    </Button>
                    <span className="text-sm px-2">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === pagination.totalPages}
                      className="h-8 px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notification Detail Modal - Mobile Friendly */}
        {selectedNotification && (
          <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
            <DialogContent className="w-[95vw] max-w-sm max-h-[95vh] p-0 overflow-hidden flex flex-col [&>button]:hidden">
              <DialogHeader className="px-3 py-2 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-1 text-xs font-medium pr-1 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {React.cloneElement(getSeverityIcon(selectedNotification.severity), { className: "w-3 h-3" })}
                    </div>
                    <span className="truncate text-xs">{selectedNotification.title}</span>
                  </DialogTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNotification(null)}
                    className="p-1 flex-shrink-0 h-6 w-6"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </DialogHeader>
              
              <div className="px-3 py-2 space-y-2 flex-1 overflow-y-auto">
                <div>
                  <h4 className="font-medium mb-1 text-xs">Description</h4>
                  <p className="text-xs text-gray-600 leading-relaxed break-words">{selectedNotification.message}</p>
                </div>
                
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">Status:</span>
                    <span className={`capitalize ${selectedNotification.status === 'pending' ? 'text-yellow-600' : selectedNotification.status === 'resolved' ? 'text-green-600' : 'text-gray-600'}`}>
                      {selectedNotification.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Severity:</span>
                    <span className={`capitalize ${selectedNotification.severity === 'critical' ? 'text-red-600' : selectedNotification.severity === 'high' ? 'text-orange-600' : 'text-gray-600'}`}>
                      {selectedNotification.severity}
                    </span>
                  </div>
                  {selectedNotification.vendor_name && (
                    <div className="flex justify-between">
                      <span className="font-medium">Vendor:</span>
                      <span className="truncate ml-1 max-w-[60%]">{selectedNotification.vendor_name}</span>
                    </div>
                  )}
                  {selectedNotification.order_id && (
                    <div className="flex justify-between">
                      <span className="font-medium">Order ID:</span>
                      <span className="truncate ml-1 max-w-[60%]">{selectedNotification.order_id}</span>
                    </div>
                  )}
                </div>
                
                {selectedNotification.error_details && (
                  <div>
                    <h4 className="font-medium mb-1 text-xs">Error Details</h4>
                    <div className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-16">
                      <div className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                        {selectedNotification.error_details}
                      </div>
                    </div>
                  </div>
                )}

                {selectedNotification.metadata && (
                  <div>
                    <h4 className="font-medium mb-1 text-xs">Additional Information</h4>
                    <div className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-16">
                      <div className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                        {JSON.stringify(selectedNotification.metadata, null, 2)}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-1 text-xs">Resolution Notes</h4>
                  <textarea
                    className="w-full p-2 border rounded text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={3}
                    placeholder="Add resolution notes..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="px-3 py-2 border-t bg-gray-50 flex-shrink-0">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedNotification(null)}
                    className="flex-1 h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleResolveNotification(selectedNotification.id)}
                    disabled={!resolutionNotes.trim()}
                    className="flex-1 h-8 text-xs"
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
