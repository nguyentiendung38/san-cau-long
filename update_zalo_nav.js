const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

code = code.replace(
  /fetch\(`\$\{API_URL\}\/booking-requests\/public`/, 
  "localStorage.setItem('courtify_phone', customerPhone);\n    fetch(`${API_URL}/booking-requests/public`"
);

// Also change "Thành viên" icon to "Giờ trống" and update navigation
code = code.replace(
  /<Box flex flexDirection="column" alignItems="center">\s*<Box p=\{3\} style=\{\{ backgroundColor: "#F5F3FF", borderRadius: "12px", marginBottom: "4px" \}\}>\s*<Icon icon="zi-user" style=\{\{ color: "#8B5CF6" \}\} \/>\s*<\/Box>\s*<Text size="xSmall" bold>Thành viên<\/Text>\s*<\/Box>/,
  `<Box 
          flex flexDirection="column" alignItems="center" 
          onClick={() => navigate("/availability")}
          style={{ cursor: "pointer" }}
        >
          <Box p={3} style={{ backgroundColor: "#F5F3FF", borderRadius: "12px", marginBottom: "4px" }}>
            <Icon icon="zi-clock-1" style={{ color: "#8B5CF6" }} />
          </Box>
          <Text size="xSmall" bold>Giờ trống</Text>
        </Box>`
);

// And change "Lịch sử" navigation
code = code.replace(
  /<Box flex flexDirection="column" alignItems="center">\s*<Box p=\{3\} style=\{\{ backgroundColor: "#FEF2F2", borderRadius: "12px", marginBottom: "4px" \}\}>\s*<Icon icon="zi-list-1" style=\{\{ color: "#EF4444" \}\} \/>\s*<\/Box>\s*<Text size="xSmall" bold>Lịch sử<\/Text>\s*<\/Box>/,
  `<Box 
          flex flexDirection="column" alignItems="center" 
          onClick={() => navigate("/history")}
          style={{ cursor: "pointer" }}
        >
          <Box p={3} style={{ backgroundColor: "#FEF2F2", borderRadius: "12px", marginBottom: "4px" }}>
            <Icon icon="zi-list-1" style={{ color: "#EF4444" }} />
          </Box>
          <Text size="xSmall" bold>Lịch sử</Text>
        </Box>`
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
