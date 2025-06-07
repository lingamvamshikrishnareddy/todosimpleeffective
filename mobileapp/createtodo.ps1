# Create root directory
$rootDir = "ToDoApp"
New-Item -ItemType Directory -Path $rootDir -Force

# Create directories
$directories = @(
    "assets/images",
    "src/components",
    "src/navigation",
    "src/screens/auth",
    "src/services",
    "src/styles",
    "src/utils"
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Path (Join-Path $rootDir $dir) -Force
}

# Create files
$files = @(
    ".env",
    "app.json",
    "babel.config.js",
    "index.js",
    "metro.config.js",
    "package.json",
    "src/App.js",
    "src/components/KanbanColumn.js",
    "src/components/SortableTask.js",
    "src/components/Task.js",
    "src/components/TaskKanban.js",
    "src/navigation/AppNavigator.js",
    "src/navigation/AuthNavigator.js",
    "src/navigation/index.js",
    "src/screens/auth/ForgotPasswordScreen.js",
    "src/screens/auth/LoginScreen.js",
    "src/screens/auth/RegisterScreen.js",
    "src/screens/HomeScreen.js",
    "src/screens/TaskScreen.js",
    "src/services/api.js",
    "src/styles/colors.js",
    "src/styles/spacing.js",
    "src/styles/typography.js"
)

foreach ($file in $files) {
    New-Item -ItemType File -Path (Join-Path $rootDir $file) -Force
}

Write-Host "Project structure created successfully in $rootDir directory"