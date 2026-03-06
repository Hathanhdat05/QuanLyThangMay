import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Layout as AntLayout, Menu, Button, Dropdown, Avatar, Typography, theme } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  ToolOutlined,
  WarningOutlined,
  CalendarOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const { token } = theme.useToken();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/customers',
      icon: <TeamOutlined />,
      label: 'Khách hàng',
    },
    {
      key: '/contracts',
      icon: <FileTextOutlined />,
      label: 'Hợp đồng',
    },
    {
      key: '/products',
      icon: <ShoppingOutlined />,
      label: 'Sản phẩm',
    },
    {
      key: '/elevators',
      icon: <ToolOutlined />,
      label: 'Thang máy',
    },
    {
      key: '/error-reports',
      icon: <WarningOutlined />,
      label: 'Báo lỗi',
    },
    {
      key: '/maintenance-calendar',
      icon: <CalendarOutlined />,
      label: 'Lịch bảo trì',
    },
    ...(isAdmin
      ? [
          {
            key: '/users',
            icon: <UserOutlined />,
            label: 'Quản lý User',
          },
        ]
      : []),
  ];

  const selectedKey = menuItems
    .filter((item) => item.key !== '/')
    .find((item) => location.pathname.startsWith(item.key))?.key || '/';

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
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    },
  ];

  const siderWidth = collapsed ? 80 : 260;

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
            <span
              style={{
                marginLeft: 12,
                fontWeight: 700,
                fontSize: 16,
                color: token.colorText,
              }}
            >
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
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <div
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Avatar
                style={{ backgroundColor: token.colorPrimary }}
                icon={<UserOutlined />}
              />
              <span style={{ fontWeight: 500 }}>
                {profile?.full_name || 'User'}
              </span>
            </div>
          </Dropdown>
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
