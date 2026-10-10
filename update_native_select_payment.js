const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const oldPayment = /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '8px' \}\}>[\s\S]*?<\/div>\s*<\/Box>/;

const newPayment = `<select 
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }}
            >
              <option value="DEPOSIT_TRANSFER">Thanh toán tại sân (Chờ kiểm tra)</option>
              <option value="VNPAY">Thanh toán online (VNPAY)</option>
            </select>
          </Box>`;

code = code.replace(oldPayment, newPayment);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
