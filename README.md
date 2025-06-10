# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# Lens Management System

## 🚀 Enhanced PDF Printing Workflow

The printing system has been completely redesigned for maximum efficiency. Here's how the new streamlined workflow works:

### ⚡ Quick Print Options

After saving an invoice, you get these efficient printing options:

1. **Quick Print (Recommended)** 
   - Press `P` key or click "Quick Print (P)" 
   - ✅ Auto-closes all modals after printing
   - ✅ Pre-fills PDF filename with customer name + invoice number
   - ✅ Auto-closes print window after saving
   - Example filename: `John_Optical_Invoice_61.pdf`

2. **Direct Download**
   - Press `D` key or click "Download (D)" button
   - ✅ Immediately triggers print dialog with smart filename
   - ✅ Auto-closes modal after download starts
   - ✅ No new tabs to manage

### 🔄 Old vs New Workflow

**Old Workflow (10+ steps):**
1. Save invoice → popup
2. Press P → print preview opens  
3. Click print → print dialog
4. Press enter → save dialog with blank name
5. Type customer name manually
6. Save file
7. Close new tab
8. Go back to CreateSale page
9. Close print preview
10. Press D for details or N for new bill

**New Workflow (2-3 steps):**
1. Save invoice → popup
2. Press P (Quick Print) → print dialog with pre-filled name
3. Press Enter → file saved, all modals auto-close ✨

### 💡 Pro Tips

- **Keyboard Shortcuts in Success Modal:**
  - `P` = Quick Print (most efficient)
  - `N` = New Bill
  - `D` = View Details  
  - `W` = WhatsApp
  - `ESC` = Go to Sales page

- **Keyboard Shortcuts in Print Modal:**
  - `P` = Quick Print with auto-close
  - `D` = Direct Download
  - `ESC` = Close modal

- **Smart Filename Generation:**
  - Automatically includes customer name and invoice number
  - Removes special characters for file system compatibility
  - Format: `CustomerName_Invoice_Number.pdf`

- **Auto-Close Feature:**
  - All modals close automatically after printing
  - No need to manually navigate back
  - Ready for next invoice immediately

### 🎯 Best Practice

For fastest invoice creation workflow:
1. Create invoice
2. Save (Ctrl+S or click Save)
3. Press `P` for Quick Print
4. Press `Enter` in print dialog
5. Press `N` for next invoice

This reduces the entire print workflow from 10+ manual steps to just 5 keystrokes!
