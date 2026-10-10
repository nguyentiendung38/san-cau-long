const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/components/layout.tsx', 'utf8');

code = code.replace(
  /import ChatAIPage from "@\/pages\/chat-ai";/,
  `import ChatAIPage from "@/pages/chat-ai";\nimport HistoryPage from "@/pages/history";\nimport AvailabilityPage from "@/pages/availability";`
);

code = code.replace(
  /<Route path="\/chat-ai" element=\{<ChatAIPage \/>\}><\/Route>/,
  `<Route path="/chat-ai" element={<ChatAIPage />}></Route>\n            <Route path="/history" element={<HistoryPage />}></Route>\n            <Route path="/availability" element={<AvailabilityPage />}></Route>`
);

fs.writeFileSync('apps/zalo-app/src/components/layout.tsx', code);
