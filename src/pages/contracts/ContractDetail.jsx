import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Descriptions, Spin, Typography, Button, Space, Table, Tag, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

const STATUS_MAP = {
  draft: { label: 'Nháp', color: 'default' },
  active: { label: 'Đang thực hiện', color: 'processing' },
  completed: { label: 'Hoàn thành', color: 'success' },
  cancelled: { label: 'Đã hủy', color: 'error' },
};

const CONTRACT_TYPE_MAP = {
  installation: { label: 'Lắp đặt', color: 'blue' },
  maintenance: { label: 'Bảo trì', color: 'gold' },
  warranty: { label: 'Bảo hành', color: 'purple' },
};

export default function ContractDetail() {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAdmin } = useAuth();

  const formatDate = (val) => {
    if (!val) return '-';
    const d = dayjs(val);
    if (!d.isValid()) return '-';
    return d.format('DD-MM-YYYY');
  };

  const formatCurrency = (val) => (val != null ? `${Number(val).toLocaleString('vi-VN')} đ` : '-');

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      const { data, error } = await api.get(`/contracts/${id}`);
      if (!isMounted) return;
      if (error || !data) {
        message.error('Không tìm thấy hợp đồng');
        navigate('/contracts');
        return;
      }
      setContract(data);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading || !contract) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  const items = contract.contract_products || [];

  const productColumns = [
    {
      title: 'Loại',
      dataIndex: 'item_type',
      key: 'item_type',
      render: (v) => (v === 'elevator' ? 'Thang máy' : 'Sản phẩm'),
    },
    {
      title: 'Tên',
      key: 'name',
      render: (_, record) => record.products?.name || record.elevator?.name || '-',
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unit_price',
      key: 'unit_price',
      align: 'right',
      render: (v) => formatCurrency(v),
    },
    {
      title: 'Thành tiền',
      key: 'total',
      align: 'right',
      render: (_, record) => formatCurrency((record.quantity || 0) * (record.unit_price || 0)),
    },
  ];

  const typeCfg = CONTRACT_TYPE_MAP[contract.contract_type];
  const statusCfg = STATUS_MAP[contract.status];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/contracts')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Chi tiết hợp đồng
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/contracts/${id}`)}>
            Sửa
          </Button>
        )}
      </Space>

      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card title="Thông tin hợp đồng">
          <Descriptions column={2} bordered size="middle">
            <Descriptions.Item label="Số hợp đồng" span={1}>
              {contract.contract_number || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Khách hàng" span={1}>
              {contract.customers?.name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Loại hợp đồng" span={1}>
              {typeCfg ? <Tag color={typeCfg.color}>{typeCfg.label}</Tag> : contract.contract_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái" span={1}>
              {statusCfg ? <Tag color={statusCfg.color}>{statusCfg.label}</Tag> : contract.status || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày bắt đầu" span={1}>
              {formatDate(contract.start_date)}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày kết thúc" span={1}>
              {formatDate(contract.end_date)}
            </Descriptions.Item>
            <Descriptions.Item label="Tổng giá trị" span={2}>
              {formatCurrency(contract.total_value)}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú" span={2}>
              {contract.notes || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Sản phẩm trong hợp đồng">
          <Table
            columns={productColumns}
            dataSource={items}
            rowKey={(record) => record.id || `${record.item_type}-${record.product_id || record.elevator_id}`}
            pagination={false}
            size="small"
          />
        </Card>
      </Space>
    </div>
  );
}

