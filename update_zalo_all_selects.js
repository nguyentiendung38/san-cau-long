const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const paymentSelect = `          <Box mt={2} mb={4}>
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

const courtSelect = `          <Box mt={2} mb={4}>
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

code = code.replace(/<Text size="small" bold style=\{\{ marginBottom: "8px" \}\}>Hình thức thanh toán:<\/Text>\s*<select[\s\S]*?<\/select>/, paymentSelect);
code = code.replace(/<Text size="small" bold style=\{\{ marginBottom: "8px" \}\}>Chọn sân:<\/Text>\s*<select[\s\S]*?<\/select>/, courtSelect);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
