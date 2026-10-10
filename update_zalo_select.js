const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

if (!code.includes('Select')) {
    code = code.replace(
        'import { Page, Header, Box, Text, Button, Icon, List, Modal, useSnackbar } from "zmp-ui";',
        'import { Page, Header, Box, Text, Button, Icon, List, Modal, useSnackbar, Select } from "zmp-ui";'
    );
}

const { Option } = "zmp-ui Select"; // pseudo

const startTimeSelect = `          <Box mt={4} mb={2}>
            <Select
              label="Giờ bắt đầu"
              placeholder="Chọn giờ"
              value={bookingTime}
              onChange={(val) => setBookingTime(val)}
              closeOnSelect
            >
              {generateTimeOptions().map(t => (
                <Select.Option key={t} value={t} title={t} />
              ))}
            </Select>
          </Box>`;

const endTimeSelect = `          <Box mt={2} mb={4}>
            <Select
              label="Giờ kết thúc"
              placeholder="Chọn giờ"
              value={endTime}
              onChange={(val) => setEndTime(val)}
              closeOnSelect
            >
              {generateTimeOptions().map(t => (
                <Select.Option key={t} value={t} title={t} />
              ))}
            </Select>
          </Box>`;

code = code.replace(/<Text size="small" bold style=\{\{ marginBottom: "8px" \}\}>Giờ bắt đầu:<\/Text>[\s\S]*?<\/select>/, startTimeSelect);
code = code.replace(/<Text size="small" bold style=\{\{ marginBottom: "8px" \}\}>Giờ kết thúc:<\/Text>[\s\S]*?<\/select>/, endTimeSelect);

// Wait, I might have renamed "Khung giờ" to "Giờ bắt đầu" with margin
code = code.replace(/<Text size="small" bold style=\{\{ marginTop: "16px", marginBottom: "8px" \}\}>Giờ bắt đầu:<\/Text>[\s\S]*?<\/select>/, startTimeSelect);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
