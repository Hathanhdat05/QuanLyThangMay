import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Descriptions, Spin, Typography, Button, Space, Image, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { api, BASE_URL } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

export default function ProductDetail() {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAdmin } = useAuth();

  const formatCurrency = (val) => (val != null ? `${Number(val).toLocaleString('vi-VN')} đ` : '-');

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      const { data, error } = await api.get(`/products/${id}`);
      if (!isMounted) return;
      if (error || !data) {
        message.error('Không tìm thấy sản phẩm');
        navigate('/products');
        return;
      }
      setProduct(data);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id, navigate]);

  if (loading || !product) {
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
          Chi tiết sản phẩm
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/products/${id}`)}>
            Sửa
          </Button>
        )}
      </Space>

      <Card title="Thông tin sản phẩm">
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="Ảnh">
            {product.image_url ? (
              <Image
                src={`${API_ORIGIN}${product.image_url}`}
                alt={product.name}
                width={120}
                height={120}
                style={{ objectFit: 'cover', borderRadius: 8 }}
                preview={{ src: `${API_ORIGIN}${product.image_url}` }}
              />
            ) : (
              <span style={{ color: '#999' }}>Chưa có ảnh</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="ID">{product.productId || product.id || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tên sản phẩm">{product.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Giá">{formatCurrency(product.price)}</Descriptions.Item>
          <Descriptions.Item label="Đơn vị">{product.unit || '-'}</Descriptions.Item>
          <Descriptions.Item label="Mô tả">{product.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="Thông số kỹ thuật">{product.specifications || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
