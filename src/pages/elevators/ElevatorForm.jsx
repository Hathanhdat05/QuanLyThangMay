import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Space, Spin, InputNumber, message, Select, Upload } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { api, BASE_URL } from '../../lib/api';
import { ELEVATOR_TYPES, ELEVATOR_BRANDS } from '../../constants/elevators';

const { Title } = Typography;
const { TextArea } = Input;

const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

export default function ElevatorForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFileList, setImageFileList] = useState([]);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (isEdit) {
        setLoading(true);
        const { data, error } = await api.get(`/elevators/${id}`);
        if (!isMounted) return;
        if (error || !data) {
          message.error('Không tìm thấy thang máy');
          navigate('/elevators');
          return;
        }
        form.setFieldsValue(data);
        if (data.image_url) {
          setImageFileList([
            {
              uid: '-1',
              name: 'image',
              status: 'done',
              url: `${API_ORIGIN}${data.image_url}`,
            },
          ]);
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await api.get('/elevators/new-id');
      if (!isMounted) return;
      if (error || !data?.elevatorId) {
        message.error('Không thể tạo ID thang máy tự động');
      } else {
        form.setFieldsValue({ elevatorId: data.elevatorId });
      }
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const uploadImage = async (file) => {
    const token = api.getToken();
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${BASE_URL}/elevators/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || data?.error || 'Upload failed');
    }
    return data?.image_url;
  };

  const onFinish = async (values) => {
    setSaving(true);
    if (isEdit) {
      const { error } = await api.put(`/elevators/${id}`, values);
      if (error) {
        message.error('Lỗi cập nhật thang máy');
      } else {
        message.success('Đã cập nhật thang máy');
        navigate('/elevators');
      }
    } else {
      const { error } = await api.post('/elevators', values);
      if (error) {
        message.error('Lỗi thêm thang máy');
      } else {
        message.success('Đã thêm thang máy');
        navigate('/elevators');
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/elevators')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? 'Sửa thang máy' : 'Thêm thang máy'}
        </Title>
      </Space>

      <Card style={{ maxWidth: 700 }}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ capacity: 0, speed: 0 }}>
          <Form.Item name="elevatorId" label="ID thang máy">
            <Input placeholder="Hệ thống tự tạo" disabled />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên thang máy"
            rules={[{ required: true, message: 'Vui lòng nhập tên thang máy' }]}
          >
            <Input placeholder="Nhập tên thang máy" />
          </Form.Item>

          <Form.Item name="type" label="Loại">
            <Select
              placeholder="Chọn loại thang máy"
              options={ELEVATOR_TYPES.map((v) => ({ label: v, value: v }))}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>

          <Form.Item name="brand" label="Thương hiệu">
            <Select
              placeholder="Chọn thương hiệu"
              options={ELEVATOR_BRANDS.map((v) => ({ label: v, value: v }))}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>

          <Form.Item name="model" label="Model">
            <Input placeholder="Nhập model" />
          </Form.Item>

          <Form.Item name="image_url" hidden>
            <Input />
          </Form.Item>

          <Form.Item label="Ảnh thang máy">
            <Upload
              listType="picture"
              maxCount={1}
              fileList={imageFileList}
              onChange={({ fileList }) => {
                setImageFileList(fileList);
                if (fileList.length === 0) form.setFieldsValue({ image_url: '' });
              }}
              beforeUpload={(file) => {
                const isImage = file.type?.startsWith('image/');
                if (!isImage) {
                  message.error('Vui lòng chọn file ảnh');
                  return Upload.LIST_IGNORE;
                }
                const isLt5M = (file.size || 0) / 1024 / 1024 < 5;
                if (!isLt5M) {
                  message.error('Ảnh phải nhỏ hơn 5MB');
                  return Upload.LIST_IGNORE;
                }
                return true;
              }}
              customRequest={async ({ file, onSuccess, onError }) => {
                try {
                  const image_url = await uploadImage(file);
                  form.setFieldsValue({ image_url });
                  const absolute = `${API_ORIGIN}${image_url}`;
                  setImageFileList([
                    {
                      uid: String(Date.now()),
                      name: file.name || 'image',
                      status: 'done',
                      url: absolute,
                    },
                  ]);
                  onSuccess?.({ image_url });
                } catch (err) {
                  message.error(err?.message || 'Upload ảnh thất bại');
                  onError?.(err);
                }
              }}
            >
              <Button>Chọn ảnh</Button>
            </Upload>
          </Form.Item>

          <Form.Item name="capacity" label="Tải trọng (kg)">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="Nhập tải trọng" />
          </Form.Item>

          <Form.Item name="speed" label="Tốc độ (m/s)">
            <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="Nhập tốc độ" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <TextArea rows={3} placeholder="Mô tả thang máy" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                {isEdit ? 'Cập nhật' : 'Thêm mới'}
              </Button>
              <Button onClick={() => navigate('/elevators')}>Hủy</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
