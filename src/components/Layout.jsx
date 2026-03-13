import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Layout as AntLayout, Menu, Button, Dropdown, Avatar, Typography, theme, Badge, Tooltip } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  ToolOutlined,
  WarningOutlined,
  CalendarOutlined,
  FormOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { api, API_ORIGIN } from '../lib/api';
import { hasViewPermission } from '../constants/viewPermissions';

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;
const UPCOMING_NOTIFICATION_TITLE = 'Nhắc bảo trì định kỳ';
let audioContextRef = null;

function getDisplayTitle(notification) {
  if (notification.type === 'maintenance_schedule_upcoming') return UPCOMING_NOTIFICATION_TITLE;
  return notification.title;
}

function playNotificationSound() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContextRef) audioContextRef = new AudioCtx();
  if (audioContextRef.state === 'suspended') {
    audioContextRef.resume().catch(() => {});
  }

  const now = audioContextRef.currentTime;
  const oscillator = audioContextRef.createOscillator();
  const gainNode = audioContextRef.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.setValueAtTime(988, now + 0.08);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  oscillator.connect(gainNode);
  gainNode.connect(audioContextRef.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.21);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function setupBrowserPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;

  const registration = await navigator.serviceWorker.register('/push-sw.js');
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const { data, error } = await api.get('/push-subscriptions/public-key');
  if (error || !data?.publicKey) return false;

  const applicationServerKey = urlBase64ToUint8Array(data.publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  await api.post('/push-subscriptions/subscribe', { subscription: subscription.toJSON() });
  return true;
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const socketRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const { token } = theme.useToken();

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await api.get('/notifications?limit=10');
    if (error) return;
    setNotifications(Array.isArray(data?.data) ? data.data : []);
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    const { data, error } = await api.get('/notifications/unread-count');
    if (error) return;
    setUnreadCount(data?.count ?? 0);
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [location.pathname, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    const socket = io(API_ORIGIN, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('notification:new', (notification) => {
      const targetUserId = notification?.user_id ? String(notification.user_id) : '';
      if (targetUserId && String(profile?.id || '') !== targetUserId) return;
      setNotifications((prev) => [notification, ...prev].slice(0, 10));
      setUnreadCount((prev) => prev + 1);
      playNotificationSound();
    });

    socket.on('notification:unread-count', ({ user_id, count }) => {
      if (user_id && String(profile?.id || '') !== String(user_id)) return;
      setUnreadCount(count);
    });

    return () => {
      socket.disconnect();
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    setupBrowserPushSubscription().catch(() => {});
  }, [profile?.id]);

  const handleBellClick = useCallback(() => {
    setupBrowserPushSubscription().catch(() => {});
  }, []);

  const handleNotificationOpenChange = useCallback(
    (open) => {
      setNotificationOpen(open);
    },
    []
  );

  const handleMarkRead = async (e, id) => {
    e.stopPropagation();
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    await api.patch('/notifications/mark-all-read');
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleDismiss = async (e, id) => {
    e.stopPropagation();
    const n = notifications.find((x) => x.id === id);
    await api.delete(`/notifications/${id}`);
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (n && !n.read) setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleNotificationClick = (n) => {
    setNotificationOpen(false);
    if (!n.read) {
      api.patch(`/notifications/${n.id}/read`);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    if (n.type === 'maintenance_schedule_upcoming' && n.maintenance_schedule_id) {
      navigate(`/maintenance-orders/schedule/${n.maintenance_schedule_id}/detail`);
    }
  };

  const menuDefinitions = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard', permission: 'dashboard' },
    { key: '/customers', icon: <TeamOutlined />, label: 'Khách hàng', permission: 'customers' },
    { key: '/contracts', icon: <FileTextOutlined />, label: 'Hợp đồng', permission: 'contracts' },
    { key: '/products', icon: <ShoppingOutlined />, label: 'Sản phẩm', permission: 'products' },
    { key: '/elevators', icon: <ToolOutlined />, label: 'Thang máy', permission: 'elevators' },
    { key: '/error-reports', icon: <WarningOutlined />, label: 'Báo lỗi', permission: 'errorReports' },
    {
      key: '/maintenance-calendar',
      icon: <CalendarOutlined />,
      label: 'Lịch bảo trì',
      permission: 'maintenanceCalendar',
    },
    ...(isAdmin
      ? [{ key: '/maintenance-orders', icon: <FormOutlined />, label: 'Đơn bảo trì', permission: 'maintenanceOrders' }]
      : [{ key: '/my-jobs', icon: <FormOutlined />, label: 'Công việc của tôi', permission: 'myJobs' }]),
    { key: '/notifications', icon: <BellOutlined />, label: 'Thông báo', permission: 'notifications' },
    { key: '/users', icon: <UserOutlined />, label: 'Quản lý User', permission: 'users', adminOnly: true },
  ];

  const menuItems = menuDefinitions.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return hasViewPermission(profile, item.permission);
  });

  const selectedKey =
    menuItems.filter((item) => item.key !== '/').find((item) => location.pathname.startsWith(item.key))?.key || '/';

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'info',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600 }}>{profile?.full_name || 'User'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {isAdmin ? 'Quản trị viên' : 'Người dùng'}
          </Text>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: handleLogout },
  ];

  const siderWidth = collapsed ? 80 : 260;

  const notificationDropdown = (
    <div
      style={{
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        width: 380,
        maxHeight: 460,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15 }}>Thông báo</span>
        {unreadCount > 0 && (
          <Tooltip title="Đánh dấu tất cả đã đọc">
            <Button type="text" size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
              Đọc tất cả
            </Button>
          </Tooltip>
        )}
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: token.colorTextSecondary }}>
            Chưa có thông báo
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => handleNotificationClick(n)}
              onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(n)}
              style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                cursor: 'pointer',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                background: n.read ? 'transparent' : token.colorPrimaryBg,
                transition: 'background 0.2s',
              }}
            >
              {!n.read && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: token.colorPrimary,
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.read ? 400 : 600, marginBottom: 2, fontSize: 13 }}>
                  {getDisplayTitle(n)}
                </div>
                <Text
                  type="secondary"
                  style={{ fontSize: 12, display: 'block' }}
                  ellipsis={{ rows: 2 }}
                >
                  {n.message}
                </Text>
                {n.createdAt && (
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: 'block' }}>
                    {new Date(n.createdAt).toLocaleString('vi-VN')}
                  </Text>
                )}
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {!n.read && (
                  <Tooltip title="Đánh dấu đã đọc">
                    <Button
                      type="text"
                      size="small"
                      icon={<CheckOutlined style={{ fontSize: 12 }} />}
                      onClick={(e) => handleMarkRead(e, n.id)}
                      style={{ width: 24, height: 24, minWidth: 24 }}
                    />
                  </Tooltip>
                )}
                <Tooltip title="Xóa">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<CloseOutlined style={{ fontSize: 12 }} />}
                    onClick={(e) => handleDismiss(e, n.id)}
                    style={{ width: 24, height: 24, minWidth: 24 }}
                  />
                </Tooltip>
              </div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          padding: '8px 16px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          textAlign: 'center',
        }}
      >
        <Button
          type="link"
          size="small"
          onClick={() => {
            setNotificationOpen(false);
            navigate('/notifications');
          }}
        >
          Xem tất cả
        </Button>
      </div>
    </div>
  );

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={260}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          overflow: 'auto',
          zIndex: 100,
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 12px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <img
            src="/logo.png"
            alt="Logo"
            style={{
              width: collapsed ? 50 : 58,
              height: collapsed ? 50 : 58,
              objectFit: 'contain',
            }}
          />
          {!collapsed && (
            <span style={{ marginLeft: 12, fontWeight: 700, fontSize: 16, color: token.colorText }}>
              Quản lý Thang máy
            </span>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', padding: '8px 0' }}
        />
      </Sider>

      <AntLayout style={{ marginLeft: siderWidth, minHeight: '100vh' }}>
        <Header
          style={{
            position: 'fixed',
            top: 0,
            left: siderWidth,
            right: 0,
            zIndex: 99,
            background: token.colorBgContainer,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            height: 64,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Dropdown
              trigger={['click']}
              open={notificationOpen}
              onOpenChange={handleNotificationOpenChange}
              dropdownRender={() => notificationDropdown}
            >
              <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} onClick={handleBellClick} />
              </Badge>
            </Dropdown>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar style={{ backgroundColor: token.colorPrimary }} icon={<UserOutlined />} />
                <span style={{ fontWeight: 500 }}>{profile?.full_name || 'User'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            margin: 24,
            marginTop: 88,
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            minHeight: 280,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
