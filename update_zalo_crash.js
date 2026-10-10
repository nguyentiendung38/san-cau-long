const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

// Fix import Select
if (!code.includes('Select } from "zmp-ui"')) {
    code = code.replace(
        'import { Page, Header, Box, Text, Button, Icon, List, Modal, useSnackbar } from "zmp-ui";',
        'import { Page, Header, Box, Text, Button, Icon, List, Modal, useSnackbar, Select } from "zmp-ui";'
    );
}

// Fix times never[]
code = code.replace('const times = [];', 'const times: string[] = [];');

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
