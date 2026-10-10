const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const oldCourtSelect = `<Box mt={2} mb={4}>
            <Select
              label="Chọn sân"
              placeholder="Đang tải danh sách sân..."
              value={selectedCourt}
              onChange={(val) => setSelectedCourt(val)}
              closeOnSelect
            >
              {courts.map(c => (
                <Select.Option key={c.id} value={c.id} title={c.name + " - " + (c.surfaceType || "Tiêu chuẩn")} />
              ))}
            </Select>
          </Box>`;

const newCourtSelect = `<Box mt={2} mb={4}>
            <Text size="small" bold style={{ marginBottom: "8px" }}>Chọn sân:</Text>
            {courts.length === 0 ? (
              <Text size="xSmall" style={{ color: "#64748B" }}>Đang tải danh sách sân...</Text>
            ) : (
              <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                {courts.map(c => (
                  <div 
                    key={c.id}
                    onClick={() => setSelectedCourt(c.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      fontWeight: selectedCourt === c.id ? 'bold' : 'normal',
                      backgroundColor: selectedCourt === c.id ? '#EFF6FF' : '#F8FAFC',
                      color: selectedCourt === c.id ? '#2563EB' : '#475569',
                      border: \`1px solid \${selectedCourt === c.id ? '#3B82F6' : '#E2E8F0'}\`,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            )}
          </Box>`;

code = code.replace(oldCourtSelect, newCourtSelect);

const oldPaymentSelect = `<Box mt={2} mb={4}>
            <Select
              label="Hình thức thanh toán"
              placeholder="Chọn hình thức"
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val)}
              closeOnSelect
            >
              <Select.Option value="DEPOSIT_TRANSFER" title="Thanh toán tại sân (Chờ kiểm tra)" />
              <Select.Option value="VNPAY" title="Thanh toán online (VNPAY)" />
            </Select>
          </Box>`;

const newPaymentSelect = `<Box mt={4} mb={4}>
            <Text size="small" bold style={{ marginBottom: "8px" }}>Hình thức thanh toán:</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div 
                  onClick={() => setPaymentMethod('DEPOSIT_TRANSFER')}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: paymentMethod === 'DEPOSIT_TRANSFER' ? 'bold' : 'normal',
                    backgroundColor: paymentMethod === 'DEPOSIT_TRANSFER' ? '#EFF6FF' : '#F8FAFC',
                    color: paymentMethod === 'DEPOSIT_TRANSFER' ? '#2563EB' : '#475569',
                    border: \`1px solid \${paymentMethod === 'DEPOSIT_TRANSFER' ? '#3B82F6' : '#E2E8F0'}\`,
                  }}
                >
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: \`5px solid \${paymentMethod === 'DEPOSIT_TRANSFER' ? '#3B82F6' : '#CBD5E1'}\`, marginRight: '12px' }}></div>
                  Thanh toán tại sân
                </div>
                <div 
                  onClick={() => setPaymentMethod('VNPAY')}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: paymentMethod === 'VNPAY' ? 'bold' : 'normal',
                    backgroundColor: paymentMethod === 'VNPAY' ? '#ECFDF5' : '#F8FAFC',
                    color: paymentMethod === 'VNPAY' ? '#10B981' : '#475569',
                    border: \`1px solid \${paymentMethod === 'VNPAY' ? '#10B981' : '#E2E8F0'}\`,
                  }}
                >
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: \`5px solid \${paymentMethod === 'VNPAY' ? '#10B981' : '#CBD5E1'}\`, marginRight: '12px' }}></div>
                  Thanh toán online (VNPAY)
                </div>
            </div>
          </Box>`;

code = code.replace(oldPaymentSelect, newPaymentSelect);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
