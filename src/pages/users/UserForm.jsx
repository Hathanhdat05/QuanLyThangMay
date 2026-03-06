import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Space, Spin, Select, message, Alert } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';

const { Title } = Typography;

export default function UserForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      api
        .get(`/users/${id}`)
        .then(({ data, error }) => {
          if (error || !data) {
            message.error('Không tìm thấy user');
            navigate('/users');
          } else {
            form.setFieldsValue({ ...data, full_name: data.full_name ?? data.fullName });
          }
          setLoading(false);
        });
    }
  }, [id]);

  const onFinish = async (values) => {
    setSaving(true);
    if (isEdit) {
      const { error } = await api.put(`/users/${id}`, {
        full_name: values.full_name,
        role: values.role,
        phone: values.phone || '',
      });
      if (error) {
        message.error('Lỗi cập nhật user');
      } else {
        message.success('Đã cập nhật user');
        navigate('/users');
      }
    } else {
      const { data, error } = await api.post('/users', {
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        role: values.role,
        phone: values.phone || '',
      });
      if (error) {
        message.error(error.message || 'Lỗi tạo user');
      } else {
        message.success('Đã tạo user mới');
        navigate('/users');
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? 'Sửa User' : 'Thêm User'}
        </Title>
      </Space>

      {!isEdit && (
        <Alert
          message="Lưu ý"
          description="User mới sẽ được tạo với email và mật khẩu, có thể đăng nhập ngay."
          type="info"
          showIcon
          style={{ marginBottom: 24, maxWidth: 700 }}
        />
      )}

      <Card style={{ maxWidth: 700 }}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ role: 'user' }}>
          <Form.Item
            name="full_name"
            label="Họ tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
          >
            <Input placeholder="Nhập họ tên" />
          </Form.Item>

          {!isEdit && (
            <>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email' },
                  { type: 'email', message: 'Email không hợp lệ' },
                ]}
              >
                <Input placeholder="Nhập email" />
              </Form.Item>

              <Form.Item
                name="password"
                label="Mật khẩu"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu' },
                  { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' },
                ]}
              >
                <Input.Password placeholder="Nhập mật khẩu" />
              </Form.Item>
            </>
          )}

          <Form.Item name="phone" label="Số điện thoại">
            <Input placeholder="Nhập số điện thoại" />
          </Form.Item>

          <Form.Item name="role" label="Vai trò" rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}>
            <Select
              options={[
                { value: 'admin', label: 'Quản trị viên (Admin)' },
                { value: 'user', label: 'Người dùng (User)' },
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                {isEdit ? 'Cập nhật' : 'Thêm mới'}
              </Button>
              <Button onClick={() => navigate('/users')}>Hủy</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
