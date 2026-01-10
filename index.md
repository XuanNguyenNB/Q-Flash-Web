# Q-Flash Web Project Index

## Configuration Files

- **[.gitignore](./.gitignore)** - Git ignore patterns for logs and build artifacts
- **[components.json](./components.json)** - Shadcn/UI component configuration with Tailwind and path aliases
- **[package.json](./package.json)** - NPM package manifest for oppo-webusb-tool project
- **[tsconfig.json](./tsconfig.json)** - TypeScript compiler configuration with React JSX and path aliases
- **[vite.config.ts](./vite.config.ts)** - Vite build configuration with React and Tailwind plugins

## Main Application

- **[index.html](./index.html)** - Q-Flash Universal Qualcomm EDL Flash Tool main HTML entry

## Internationalization

- **[vi.json](./vi.json)** - Vietnamese translation file for EDL flash tool UI

## Source Directories

### [src/](./src/)
Main application source code directory containing:
- React application components and pages
- Core EDL, ADB, and Fastboot functionality
- State management stores and hooks
- Service layer for device communication
- UI component library

### [public/](./public/)
Static assets directory containing:
- Firehose programmer files for EDL mode
- Device configuration presets
- Images and icons
- Scrcpy server binary

### [docs/](./docs/)
Project documentation including:
- Architecture diagrams and specifications
- Development guides and PRDs
- Epic and story tracking documents
- UX design specifications
- Feature implementation logs

### [bmad/](./bmad/)
BMAD framework directory with:
- Core tasks and tools
- BMM workflow configurations
- Agent definitions

### [analytics-backend/](./analytics-backend/)
Backend analytics service with dashboard and deployment scripts

### [dist/](./dist/)
Production build output directory (generated)

### [node_modules/](./node_modules/)
NPM dependencies (generated)

## Device-Specific Files

### [OPPO-8g3-X7Ultra-PHY110-UBL/](./OPPO-8g3-X7Ultra-PHY110-UBL/)
OPPO X7 Ultra EDL programmer and bootloader files

## Temporary/Development Files

- **[.temp_partition_preview.txt](./.temp_partition_preview.txt)** - Temporary partition table preview data
- **[temp_old.ts](./temp_old.ts)** - Backup of old TypeScript code
- **[temp_power.txt](./temp_power.txt)** - Temporary power management notes
- **[temp_xmlflash.txt](./temp_xmlflash.txt)** - XML flash configuration dump
- **[temp_xmlflash2.txt](./temp_xmlflash2.txt)** - Alternative XML flash configuration
- **[tsc_output.txt](./tsc_output.txt)** - TypeScript compiler output log
