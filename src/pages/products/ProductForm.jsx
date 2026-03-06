import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Space, Spin, InputNumber, message, Upload } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { api, BASE_URL } from '../../lib/api';

const { Title } = Typography;
const { TextArea } = Input;

const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

export default function ProductForm() {
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
        const { data, error } = await api.get(`/products/${id}`);
        if (!isMounted) return;
        if (error || !data) {
          message.error('Không tìm thấy sản phẩm');
          navigate('/products');
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
      const { data, error } = await api.get('/products/new-id');
      if (!isMounted) return;
      if (error || !data?.productId) {
        message.error('Không thể tạo ID sản phẩm tự động');
      } else {
        form.setFieldsValue({ productId: data.productId });
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

    const res = await fetch(`${BASE_URL}/products/upload-image`, {
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
      const { error } = await api.put(`/products/${id}`, values);
      if (error) {
        message.error('Lỗi cập nhật sản phẩm');
      } else {
        message.success('Đã cập nhật sản phẩm');
        navigate('/products');
      }
    } else {
      const { error } = await api.post('/products', values);
      if (error) {
        message.error('Lỗi thêm sản phẩm');
      } else {
        message.success('Đã thêm sản phẩm');
        navigate('/products');
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
        </Title>
      </Space>

      <Card style={{ maxWidth: 700 }}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ unit: 'cái', price: 0 }}>
          <Form.Item name="productId" label="ID sản phẩm">
            <Input placeholder="Hệ thống tự tạo" disabled />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên sản phẩm"
            rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm' }]}
          >
            <Input placeholder="Nhập tên sản phẩm" />
          </Form.Item>

          <Form.Item name="image_url" hidden>
            <Input />
          </Form.Item>

          <Form.Item label="Ảnh sản phẩm">
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

          <Form.Item name="price" label="Giá (VNĐ)">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => v.replace(/,/g, '')}
              placeholder="Nhập giá"
            />
          </Form.Item>

          <Form.Item name="unit" label="Đơn vị">
            <Input placeholder="VD: cái, bộ, chiếc..." />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <TextArea rows={3} placeholder="Mô tả sản phẩm" />
          </Form.Item>

          <Form.Item name="specifications" label="Thông số kỹ thuật">
            <TextArea rows={3} placeholder="Thông số kỹ thuật" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                {isEdit ? 'Cập nhật' : 'Thêm mới'}
              </Button>
              <Button onClick={() => navigate('/products')}>Hủy</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
