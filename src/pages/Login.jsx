import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Alert } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { apiConfigured } from '../lib/api';

const { Title, Text } = Typography;

export default function Login() {
  const { user, signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onFinish = async (values) => {
    if (!apiConfigured) {
      message.error('Chưa cấu hình API. Vui lòng tạo file .env với VITE_API_URL');
      return;
    }
    setLoading(true);
    const { error } = await signIn(values.email, values.password);
    if (error) {
      message.error(error.message || 'Email hoặc mật khẩu không đúng');
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'url("/login-bg.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Card
        style={{
          width: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
        }}
        styles={{ body: { padding: 40 } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/logo.png"
            alt="Logo"
            style={{
              width: 250,
              height: 250,
              objectFit: 'contain',
              margin: '0 auto 1px',
              display: 'block',
            }}
          />
          <Title level={3} style={{ marginBottom: 4 }}>
            Quản lý Thang máy
          </Title>
          <Text type="secondary">Đăng nhập để tiếp tục</Text>
        </div>

        {!apiConfigured && (
          <Alert
            message="Chưa cấu hình API"
            description={
              <div>
                <p>
                  Tạo file <code>.env</code> trong thư mục gốc với:
                </p>
                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 12 }}>
                  {`VITE_API_URL=http://localhost:3001/api`}
                </pre>
                <p style={{ margin: 0 }}>
                  Chạy backend: <code>cd backend && npm run dev</code>. Sau đó khởi động lại <code>npm run dev</code>.
                </p>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44, borderRadius: 8, fontWeight: 600 }}
            >
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
