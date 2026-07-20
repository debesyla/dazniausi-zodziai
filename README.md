# Dažniausi lietuviški žodžiai

[![Deploy to GitHub Pages](https://github.com/Debesyla/dazniausi-zodziai/actions/workflows/deploy.yml/badge.svg)](https://github.com/Debesyla/dazniausi-zodziai/actions/workflows/deploy.yml)

An interactive web application for exploring Lithuanian word frequency datasets. Built with a distinctive Baltic amber terminal aesthetic to make linguistic data exploration engaging and accessible for researchers, linguists, and students.

🌐 **Live Demo**: [https://debesyla.github.io/dazniausi-zodziai](https://debesyla.github.io/dazniausi-zodziai)

## ✨ Features

- **Dataset Browser**: Load and explore multiple Lithuanian word frequency datasets
- **Interactive Search**: Filter words by text input with real-time results
- **Advanced Sorting**: Sort by word (A-Z) or frequency count
- **Type Filtering**: Filter words by grammatical type/category
- **Data Export**: Download filtered results in CSV format
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Cultural Design**: Unique Baltic amber terminal-inspired interface
- **Fast Performance**: Client-side processing with sub-2-second load times

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm, pnpm, or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Debesyla/dazniausi-zodziai.git
cd dazniausi-zodziai
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## 📊 Usage

1. **Select Dataset**: Choose from available Lithuanian word frequency datasets using the dropdown
2. **Browse Data**: View words in a sortable table with frequency information
3. **Search & Filter**: Use the search bar to find specific words or filter by type
4. **Download**: Export your filtered results as CSV for further analysis

## 🛠️ Tech Stack

- **Framework**: [SvelteKit](https://svelte.dev/) - Modern web framework
- **Language**: TypeScript - Type-safe JavaScript
- **Build Tool**: [Vite](https://vitejs.dev/) - Fast build tool
- **Styling**: Custom CSS with Baltic amber theme
- **Data Processing**: [PapaParse](https://www.papaparse.com/) - CSV parsing
- **Testing**: [Vitest](https://vitest.dev/) + Testing Library
- **Deployment**: GitHub Pages with GitHub Actions

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── DataLoader.svelte    # Dataset loading and display
│   ├── DataTable.svelte     # Sortable data table
│   ├── SearchBar.svelte     # Search and filter interface
│   └── DownloadButton.svelte # Data export functionality
├── lib/
│   ├── data.ts          # Dataset management
│   ├── translations.ts  # Lithuanian translations
│   └── utils.ts         # Utility functions
├── routes/
│   └── +page.svelte     # Main application page
└── data/                # Sample datasets
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## 🗂️ Dataset preparation

Datasets are prepared by maintainers before publication; visitors do not upload files in the browser. See [the dataset preparation guide](docs/data-preparation.md) for the validated CSV/TSV conversion command and dataset configuration format.

## 🚢 Deployment

The application is automatically deployed to GitHub Pages on every push to the main branch via GitHub Actions.

### Manual Deployment

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## 🤝 Contributing

Contributions are welcome! This project aims to make Lithuanian linguistic data more accessible.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Lithuanian linguists and researchers who collected the word frequency data
- The Svelte community for the excellent framework
- Baltic design inspiration for the unique aesthetic

## AI notice

This whole project was AI generated.
