import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Space, Popconfirm, Typography, message, Image } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { api, BASE_URL } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;
const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const fetchProducts = async () => {
    setLoading(true);
    const path = search ? `/products?search=${encodeURIComponent(search)}` : '/products';
    const { data, error } = await api.get(path);
    if (error) {
      message.error('Lỗi tải dữ liệu');
    } else {
      setProducts(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const handleDelete = async (id) => {
    const { error } = await api.delete(`/products/${id}`);
    if (error) {
      message.error('Lỗi xóa sản phẩm');
    } else {
      message.success('Đã xóa sản phẩm');
      fetchProducts();
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedRowKeys.length) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedRowKeys) {
        // eslint-disable-next-line no-await-in-loop
        const { error } = await api.delete(`/products/${id}`);
        if (error) {
          message.error('Lỗi xóa một số sản phẩm, vui lòng thử lại');
          break;
        }
      }
      setSelectedRowKeys([]);
      await fetchProducts();
      message.success('Đã xóa các sản phẩm đã chọn');
    } finally {
      setBulkDeleting(false);
    }
  };

  const formatCurrency = (val) => (val != null ? Number(val).toLocaleString('vi-VN') + ' đ' : '');

  const columns = [
    {
      title: 'Ảnh',
      dataIndex: 'image_url',
      key: 'image_url',
      width: 80,
      render: (val, record) => {
        if (!val) return <span style={{ color: '#999' }}>-</span>;
        const src = `${API_ORIGIN}${val}`;
        return (
          <Image
            src={src}
            alt={record?.name || 'product'}
            width={48}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 8 }}
            preview={{ src }}
          />
        );
      },
    },
    {
      title: 'ID',
      dataIndex: 'productId',
      key: 'productId',
      width: 140,
      sorter: (a, b) => (a.productId || '').localeCompare(b.productId || ''),
      render: (val, record) => {
        const displayId = val || record?.id;
        const rowId = record?.id;
        if (!displayId) return <span style={{ color: '#999' }}>-</span>;
        if (!rowId) return <span style={{ whiteSpace: 'normal' }}>{String(displayId)}</span>;
        return (
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/products/${rowId}/detail`)}
            style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}
          >
            {String(displayId)}
          </Button>
        );
      },
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Giá',
      dataIndex: 'price',
      key: 'price',
      render: formatCurrency,
      sorter: (a, b) => (a.price || 0) - (b.price || 0),
    },
    { title: 'Đơn vị', dataIndex: 'unit', key: 'unit' },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      render: (_, record) =>
        isAdmin ? (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => navigate(`/products/${record.id}`)}
            />
            <Popconfirm
              title="Xóa sản phẩm?"
              description="Bạn có chắc muốn xóa sản phẩm này?"
              onConfirm={() => handleDelete(record.id)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  const rowSelection = isAdmin
    ? {
        selectedRowKeys,
        onChange: setSelectedRowKeys,
      }
    : undefined;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản lý Sản phẩm
        </Title>
        {isAdmin && (
          <Space>
            {selectedRowKeys.length > 0 && (
              <Button danger onClick={handleBulkDelete} loading={bulkDeleting}>
                Xóa đã chọn ({selectedRowKeys.length})
              </Button>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/new')}>
              Thêm sản phẩm
            </Button>
          </Space>
        )}
      </div>

      <Input
        placeholder="Tìm kiếm theo ID (SP...), tên, mô tả..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 400 }}
        allowClear
      />

      <Table
        columns={columns}
        dataSource={products}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} sản phẩm` }}
      />
    </div>
  );
}
