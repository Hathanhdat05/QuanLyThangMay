import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Space,
  Spin,
  Select,
  DatePicker,
  message,
  InputNumber,
  Alert,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;
const { TextArea } = Input;

export default function ErrorReportForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [elevatorOptions, setElevatorOptions] = useState([]);
  const [elevatorMaintenanceEndDates, setElevatorMaintenanceEndDates] = useState({});
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const isEdit = Boolean(id);

  useEffect(() => {
    loadLookups();
    if (isEdit) {
      loadReport();
    } else {
      loadNewErrorId();
    }
  }, [id]);

  const loadLookups = async () => {
    const [custRes, contRes, prodRes] = await Promise.all([
      api.get('/customers'),
      api.get('/contracts'),
      api.get('/products'),
    ]);
    setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
    setContracts(Array.isArray(contRes.data) ? contRes.data : []);
    setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
  };

  const loadNewErrorId = async () => {
    const { data, error } = await api.get('/error-reports/new-id');
    if (!error && data?.errorId) {
      form.setFieldsValue({ errorId: data.errorId });
    }
  };

  const loadContractElevators = async (contractId, initialElevatorId = null) => {
    if (!contractId) {
      setElevatorOptions([]);
      setElevatorMaintenanceEndDates({});
      form.setFieldsValue({ elevator_id: null });
      return;
    }

    const { data, error } = await api.get(`/contracts/${contractId}`);
    if (error || !data) {
      message.error('Không thể lấy thông tin hợp đồng');
      setElevatorOptions([]);
      setElevatorMaintenanceEndDates({});
      form.setFieldsValue({ elevator_id: null });
      return;
    }

    const items = Array.isArray(data.contract_products) ? data.contract_products : [];
    const elevatorItems = items.filter((it) => it && (it.item_type === 'elevator' || it.elevator_id));

    if (!elevatorItems.length) {
      message.warning('Hợp đồng này chưa có thang máy gắn kèm. Vui lòng kiểm tra lại dữ liệu hợp đồng.');
      setElevatorOptions([]);
      setElevatorMaintenanceEndDates({});
      form.setFieldsValue({ elevator_id: null });
      return;
    }

    const options = elevatorItems.map((it) => ({
      value: it.elevator_id,
      label: it.elevator?.name || it.elevator_id,
    }));

    const maintenanceEndMap = {};
    elevatorItems.forEach((it) => {
      if (it.elevator_id) maintenanceEndMap[it.elevator_id] = it.elevator?.maintenance_end_date || null;
    });
    setElevatorMaintenanceEndDates(maintenanceEndMap);

    setElevatorOptions(options);

    const selectedFromReport = initialElevatorId || form.getFieldValue('elevator_id');
    if (selectedFromReport && options.some((o) => o.value === selectedFromReport)) {
      form.setFieldsValue({ elevator_id: selectedFromReport });
    } else if (options.length === 1) {
      form.setFieldsValue({ elevator_id: options[0].value });
    } else {
      form.setFieldsValue({ elevator_id: null });
    }

    const elevatorId = initialElevatorId || form.getFieldValue('elevator_id');
    const reportedDateVal = form.getFieldValue('reported_date');
    const endDateVal = elevatorId ? maintenanceEndMap[elevatorId] : null;
    const inPeriod =
      endDateVal &&
      reportedDateVal &&
      dayjs(endDateVal).endOf('day').valueOf() >= dayjs(reportedDateVal).startOf('day').valueOf();
    if (inPeriod) {
      const currentItems = form.getFieldValue('items') || [];
      if (currentItems.length) {
        const next = currentItems.map((it) =>
          it && it.product_id ? { ...it, unit_price: 0 } : it
        );
        form.setFieldsValue({ items: next });
      }
    }
  };

  const loadReport = async () => {
    setLoading(true);
    const { data, error } = await api.get(`/error-reports/${id}`);
    if (error || !data) {
      message.error('Không tìm thấy báo lỗi');
      navigate('/error-reports');
    } else {
      const contractIdFromReport = data.contract_id || null;
      const contractNumberFromReport = data.contracts?.contract_number;
      const errorIdFromReport = data.errorId || data.id || null;

      const formValues = {
        ...data,
        errorId: errorIdFromReport,
        reported_date: data.reported_date ? dayjs(data.reported_date) : null,
        scheduled_date: data.scheduled_date ? dayjs(data.scheduled_date) : null,
        completed_date: data.completed_date ? dayjs(data.completed_date) : null,
      };
      if (Array.isArray(data.items) && data.items.length > 0) {
        formValues.items = data.items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity ?? 1,
          unit_price: it.unit_price ?? 0,
        }));
      }
      form.setFieldsValue(formValues);
      setSelectedCustomerId(data.customer_id || null);
      setSelectedContractId(contractIdFromReport);

      // Đảm bảo hợp đồng hiện tại luôn có trong danh sách options để Select hiển thị số hợp đồng thay vì id
      if (contractIdFromReport && contractNumberFromReport) {
        setContracts((prev) => {
          if (prev.some((c) => c.id === contractIdFromReport)) return prev;
          return [
            ...prev,
            {
              id: contractIdFromReport,
              contract_number: contractNumberFromReport,
              customer_id: data.customer_id || null,
              contract_type: data.type === 'warranty' ? 'warranty' : 'maintenance',
              status: 'draft',
            },
          ];
        });
      }

      if (contractIdFromReport) {
        await loadContractElevators(contractIdFromReport, data.elevator_id || null);
      } else {
        setElevatorOptions([]);
      }
    }
    setLoading(false);
  };

  const handleValuesChange = async (changedValues) => {
    if ('customer_id' in changedValues) {
      const customerId = changedValues.customer_id || null;
      setSelectedCustomerId(customerId);
      setSelectedContractId(null);
      form.setFieldsValue({ contract_id: null, elevator_id: null });
    }

    if ('contract_id' in changedValues) {
      const contractId = changedValues.contract_id || null;
      setSelectedContractId(contractId);

      await loadContractElevators(contractId);
    }

    if ('elevator_id' in changedValues || 'reported_date' in changedValues) {
      const elevatorId = changedValues.elevator_id ?? form.getFieldValue('elevator_id');
      const reportedDate = changedValues.reported_date ?? form.getFieldValue('reported_date');
      const endDate = elevatorId ? elevatorMaintenanceEndDates[elevatorId] : null;
      const inPeriod =
        endDate &&
        reportedDate &&
        dayjs(endDate).endOf('day').valueOf() >= dayjs(reportedDate).startOf('day').valueOf();
      if (inPeriod) {
        const items = form.getFieldValue('items') || [];
        if (items.length) {
          const next = items.map((it) => (it && it.product_id ? { ...it, unit_price: 0 } : it));
          form.setFieldsValue({ items: next });
        }
      }
    }
  };

  const customerIdsWithContracts = new Set(
    contracts
      .filter((c) => c.contract_type === 'installation' && c.status === 'completed')
      .map((c) => c.customer_id)
      .filter((cid) => typeof cid === 'string' && cid)
  );

  const customerOptions = customers
    .filter((c) => customerIdsWithContracts.has(c.id))
    .map((c) => ({ value: c.id, label: c.name }));

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.name}${p.unit ? ` (${p.unit})` : ''}`,
  }));

  const filteredContracts = contracts.filter((c) => {
    const baseMatch =
      c.customer_id === selectedCustomerId &&
      c.contract_type === 'installation' &&
      c.status === 'completed';

    if (baseMatch) return true;

    // Luôn cho phép hiển thị hợp đồng đã được gán cho báo lỗi, kể cả khi không phải installation/completed
    if (selectedContractId && c.id === selectedContractId) return true;

    return false;
  });

  const contractOptions = filteredContracts.map((c) => ({
    value: c.id,
    label: c.contract_number,
  }));

  const selectedElevatorId = Form.useWatch('elevator_id', form);
  const reportedDate = Form.useWatch('reported_date', form);
  const maintenanceEndDate = selectedElevatorId ? elevatorMaintenanceEndDates[selectedElevatorId] : null;
  const inMaintenancePeriod =
    Boolean(maintenanceEndDate && reportedDate) &&
    dayjs(maintenanceEndDate).endOf('day').valueOf() >= dayjs(reportedDate).startOf('day').valueOf();

  const formItems = Form.useWatch('items', form) || [];
  const totalAmount = inMaintenancePeriod
    ? 0
    : formItems.reduce(
        (sum, it) => sum + (Number(it?.quantity) || 0) * (Number(it?.unit_price) || 0),
        0
      );

  const onFinish = async (values) => {
    setSaving(true);
    const payload = {
      elevator_id: values.elevator_id || null,
      customer_id: values.customer_id || null,
      contract_id: values.contract_id || null,
      title: values.title,
      description: values.description || '',
      type: 'maintenance',
      status: values.status || 'pending',
      priority: values.priority || 'medium',
      reported_date: values.reported_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
      scheduled_date: values.scheduled_date?.format('YYYY-MM-DD') || null,
      completed_date: values.completed_date?.format('YYYY-MM-DD') || null,
      items: Array.isArray(values.items)
        ? values.items
            .filter((it) => it && it.product_id)
            .map((it) => ({
              product_id: it.product_id,
              quantity: it.quantity ? Number(it.quantity) : 1,
              unit_price: it.unit_price ? Number(it.unit_price) : 0,
            }))
        : [],
    };
    if (!isEdit) payload.reported_by = user?.id || null;

    if (isEdit) {
      const { error } = await api.put(`/error-reports/${id}`, payload);
      if (error) {
        message.error('Lỗi cập nhật báo lỗi');
      } else {
        message.success('Đã cập nhật báo lỗi');
        navigate('/error-reports');
      }
    } else {
      const { error } = await api.post('/error-reports', payload);
      if (error) {
        message.error('Lỗi tạo báo lỗi');
      } else {
        message.success('Đã tạo báo lỗi');
        navigate('/error-reports');
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/error-reports')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? 'Sửa báo lỗi' : 'Tạo báo lỗi'}
        </Title>
      </Space>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={handleValuesChange}
        initialValues={{
          status: 'pending',
          priority: 'medium',
          reported_date: dayjs(),
        }}
      >
        <Card title="Thông tin báo lỗi" style={{ marginBottom: 24 }}>
          <Form.Item name="errorId" label="ID báo lỗi">
            <Input disabled />
          </Form.Item>

          <Form.Item
            name="title"
            label="Tiêu đề"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input placeholder="Nhập tiêu đề báo lỗi" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả chi tiết">
            <TextArea rows={4} placeholder="Mô tả chi tiết lỗi / yêu cầu bảo trì" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="priority" label="Mức độ ưu tiên">
              <Select
                options={[
                  { value: 'low', label: 'Thấp' },
                  { value: 'medium', label: 'Trung bình' },
                  { value: 'high', label: 'Cao' },
                  { value: 'critical', label: 'Nghiêm trọng' },
                ]}
              />
            </Form.Item>

            <Form.Item name="status" label="Trạng thái">
              <Select
                disabled={!isAdmin && isEdit}
                options={[
                  { value: 'pending', label: 'Chờ xử lý' },
                  { value: 'in_progress', label: 'Đang xử lý' },
                  { value: 'resolved', label: 'Đã xử lý' },
                  { value: 'closed', label: 'Đã đóng' },
                ]}
              />
            </Form.Item>
          </div>
        </Card>

        <Card title="Liên kết" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item
              name="customer_id"
              label="Khách hàng"
              rules={[{ required: true, message: 'Vui lòng chọn khách hàng' }]}
            >
              <Select
                placeholder="Chọn khách hàng"
                allowClear
                showSearch
                optionFilterProp="label"
                options={customerOptions}
              />
            </Form.Item>

            <Form.Item
              name="contract_id"
              label="Hợp đồng"
              rules={[{ required: true, message: 'Vui lòng chọn hợp đồng' }]}
            >
              <Select
                placeholder="Chọn hợp đồng"
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={!selectedCustomerId}
                options={contractOptions}
              />
            </Form.Item>

            <Form.Item name="elevator_id" label="Thang máy">
              <Select
                placeholder={
                  elevatorOptions.length ? 'Chọn thang máy' : 'Không có thang máy trong hợp đồng'
                }
                disabled={!elevatorOptions.length}
                allowClear
                showSearch
                optionFilterProp="label"
                options={elevatorOptions}
              />
            </Form.Item>
          </div>
        </Card>

        <Card title="Sản phẩm" style={{ marginBottom: 24 }}>
          {inMaintenancePeriod && (
            <Alert
              type="info"
              message="Thang máy đang trong thời gian bảo trì của hợp đồng — không tính tiền vật tư."
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <div
                    key={field.key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2.5fr 1fr 1fr 1fr auto',
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    <Form.Item
                      name={[field.name, 'product_id']}
                      label={index === 0 ? 'Sản phẩm' : ''}
                      rules={[{ required: true, message: 'Vui lòng chọn sản phẩm' }]}
                    >
                      <Select
                        placeholder="Chọn sản phẩm"
                        showSearch
                        optionFilterProp="label"
                        options={productOptions}
                        onChange={(value) => {
                          const product = products.find((p) => p.id === value);
                          const currentItems = form.getFieldValue('items') || [];
                          const nextItems = [...currentItems];
                          const row = { ...(nextItems[field.name] || {}) };
                          row.product_id = value;
                          row.unit_price = inMaintenancePeriod ? 0 : product?.price ?? 0;
                          if (!row.quantity) row.quantity = 1;
                          nextItems[field.name] = row;
                          form.setFieldsValue({ items: nextItems });
                        }}
                      />
                    </Form.Item>

                    <Form.Item
                      name={[field.name, 'quantity']}
                      label={index === 0 ? 'Số lượng' : ''}
                      rules={[{ required: true, message: 'Nhập số lượng' }]}
                    >
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                      name={[field.name, 'unit_price']}
                      label={index === 0 ? 'Đơn giá' : ''}
                      rules={inMaintenancePeriod ? [] : [{ required: true, message: 'Nhập đơn giá cho sản phẩm' }]}
                    >
                      <InputNumber
                        min={0}
                        style={{ width: '100%' }}
                        disabled={inMaintenancePeriod}
                        formatter={(value) =>
                          value != null
                            ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                            : ''
                        }
                        parser={(value) => value.replace(/,/g, '')}
                      />
                    </Form.Item>

                    <Form.Item label={index === 0 ? 'Thành tiền' : ''}>
                      <div style={{ lineHeight: '32px' }}>
                        {inMaintenancePeriod
                          ? '0 đ'
                          : (() => {
                              const row = formItems?.[field.name] || {};
                              const amount = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);
                              return amount ? `${amount.toLocaleString('vi-VN')} đ` : '-';
                            })()}
                      </div>
                    </Form.Item>

                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ quantity: 1 })}
                  style={{ marginTop: 8 }}
                >
                  Thêm sản phẩm
                </Button>

                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <strong>
                    Tổng tiền: {inMaintenancePeriod ? '0 đ (trong thời gian bảo trì)' : `${totalAmount.toLocaleString('vi-VN')} đ`}
                  </strong>
                </div>
              </>
            )}
          </Form.List>
        </Card>

        <Card title="Thời gian" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item name="reported_date" label="Ngày báo cáo">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item name="scheduled_date" label="Ngày hẹn xử lý">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item name="completed_date" label="Ngày hoàn thành">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </div>
        </Card>

        <Space>
          <Button type="primary" htmlType="submit" loading={saving} size="large">
            {isEdit ? 'Cập nhật' : 'Tạo mới'}
          </Button>
          <Button size="large" onClick={() => navigate('/error-reports')}>
            Hủy
          </Button>
        </Space>
      </Form>
    </div>
  );
}
