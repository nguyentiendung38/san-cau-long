const fs = require('fs');
let content = fs.readFileSync('apps/frontend/src/pages/SettingsPage.tsx', 'utf8');

content = content.replace('const queryClient = useQueryClient();', 
    'const queryClient = useQueryClient();\n\n' +
    '    const deleteCustomerMutation = useMutation({\n' +
    '        mutationFn: (id: string) => customerApi.delete(id),\n' +
    '        onSuccess: () => {\n' +
    '            toast({ title: \'Ð? xóa tài kho?n kh?i CSDL\' });\n' +
    '            queryClient.invalidateQueries({ queryKey: [\'registered-users\'] });\n' +
    '        },\n' +
    '        onError: () => {\n' +
    '            toast({ title: \'L?i khi xóa tài kho?n\', variant: \'error\' });\n' +
    '        }\n' +
    '    });\n\n' +
    '    const handleDeleteCustomer = (user: any) => {\n' +
    '        if (confirm(B?n có ch?c mu?n xóa v?nh vi?n tài kho?n c?a \ kh?i CSDL?)) {\n' +
    '            deleteCustomerMutation.mutate(user.id);\n' +
    '        }\n' +
    '    };'
);

content = content.replace(
    '<div className=\"grid grid-cols-4 gap-4 pb-2 border-b border-border text-sm font-medium text-foreground-secondary\">\n                                        <div className=\"col-span-2\">Khách hàng</div>\n                                        <div>S? ði?n tho?i</div>\n                                        <div>Ngày ðãng k?</div>\n                                    </div>',
    '<div className=\"grid grid-cols-5 gap-4 pb-2 border-b border-border text-sm font-medium text-foreground-secondary\">\n                                        <div className=\"col-span-2\">Khách hàng</div>\n                                        <div>S? ði?n tho?i</div>\n                                        <div>Ngày ðãng k?</div>\n                                        <div className=\"text-right\">Thao tác</div>\n                                    </div>'
);

content = content.replace(/className=\"grid grid-cols-4 gap-4 py-3 border-b border-border\/50 items-center text-sm\"/g, 'className=\"grid grid-cols-5 gap-4 py-3 border-b border-border/50 items-center text-sm\"');

content = content.replace(
    /\{new Date\(user\.createdAt\)\.toLocaleDateString\('vi-VN'\)\}\n\s*<\/div>\n\s*<\/div>\n\s*\)\)\}/g,
    "{new Date(user.createdAt).toLocaleDateString('vi-VN')}\n" +
    "                                            </div>\n" +
    "                                            <div className=\"text-right flex justify-end\">\n" +
    "                                                <button \n" +
    "                                                    onClick={() => handleDeleteCustomer(user)}\n" +
    "                                                    className=\"p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors\"\n" +
    "                                                    title=\"Xóa tài kho?n\"\n" +
    "                                                >\n" +
    "                                                    <Trash2 className=\"w-4 h-4\" />\n" +
    "                                                </button>\n" +
    "                                            </div>\n" +
    "                                        </div>\n" +
    "                                    ))}"
);

fs.writeFileSync('apps/frontend/src/pages/SettingsPage.tsx', content, 'utf8');
