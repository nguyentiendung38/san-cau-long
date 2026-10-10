const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const startTimeInput = `          <Box mt={4} mb={2}>
            <Text size="small" bold style={{ marginBottom: "8px" }}>Giờ bắt đầu:</Text>
            <input 
              type="time" 
              value={bookingTime} 
              onChange={(e) => setBookingTime(e.target.value)} 
              step="1800"
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }} 
            />
          </Box>`;

const endTimeInput = `          <Box mt={2} mb={4}>
            <Text size="small" bold style={{ marginBottom: "8px" }}>Giờ kết thúc:</Text>
            <input 
              type="time" 
              value={endTime} 
              onChange={(e) => setEndTime(e.target.value)} 
              step="1800"
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }} 
            />
          </Box>`;

code = code.replace(/<Box mt=\{4\} mb=\{2\}>\s*<Select\s*label="Giờ bắt đầu"[\s\S]*?<\/Select>\s*<\/Box>/, startTimeInput);
code = code.replace(/<Box mt=\{2\} mb=\{4\}>\s*<Select\s*label="Giờ kết thúc"[\s\S]*?<\/Select>\s*<\/Box>/, endTimeInput);

// Add the 30 minute validation logic back in submitBooking
code = code.replace(
  /if \(endTime <= bookingTime\) \{\s*openSnackbar\(\{ type: "warning", text: "Giờ kết thúc phải lớn hơn giờ bắt đầu!" \}\);\s*return;\s*\}/,
  `if (endTime <= bookingTime) {
      openSnackbar({ type: "warning", text: "Giờ kết thúc phải lớn hơn giờ bắt đầu!" });
      return;
    }
    
    const [startH, startM] = bookingTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (startM % 30 !== 0 || endM % 30 !== 0) {
      openSnackbar({ type: "warning", text: "Phút phải là số chẵn (00 hoặc 30). Ví dụ: 14:00, 14:30" });
      return;
    }`
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
