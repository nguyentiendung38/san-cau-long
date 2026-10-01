const fs = require('fs');
let content = fs.readFileSync('apps/frontend/src/pages/SettingsPage.tsx', 'utf8');

const startMarker = 'const deleteCustomerMutation = useMutation({';
const endMarker = '    const handleDeleteCustomer = (user: any) => {';
const endMarker2 = '    // Fetch venues';

const start = content.indexOf(startMarker);
const end = content.indexOf(endMarker2, start);

if (start !== -1 && end !== -1) {
    const newBlock = 
    'const deleteCustomerMutation = useMutation({\r\n' +
    '        mutationFn: (id: string) => customerApi.delete(id),\r\n' +
    '        onSuccess: () => {\r\n' +
    "            toast({ title: '\u0110\u00e3 x\u00f3a t\u00e0i kho\u1ea3n kh\u1ecfi CSDL' });\r\n" +
    "            queryClient.invalidateQueries({ queryKey: ['registered-users'] });\r\n" +
    '        },\r\n' +
    '        onError: () => {\r\n' +
    "            toast({ title: 'L\u1ed7i khi x\u00f3a t\u00e0i kho\u1ea3n', variant: 'error' });\r\n" +
    '        }\r\n' +
    '    });\r\n\r\n' +
    '    const handleDeleteCustomer = (user: any) => {\r\n' +
    "        if (confirm(`B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a v\u0129nh vi\u1ec5n t\u00e0i kho\u1ea3n c\u1ee7a ${user.name} kh\u1ecfi CSDL?`)) {\r\n" +
    '            deleteCustomerMutation.mutate(user.id);\r\n' +
    '        }\r\n' +
    '    };\r\n\r\n' +
    '    ';

    const newContent = content.substring(0, start) + newBlock + content.substring(end);
    fs.writeFileSync('apps/frontend/src/pages/SettingsPage.tsx', newContent, 'utf8');
    console.log('Done!');
} else {
    console.log('Markers not found. start:', start, 'end:', end);
}
