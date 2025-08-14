# Smart Door System

This project implements a smart door system that integrates facial recognition using AI. It consists of a backend built with FastAPI, a frontend developed with Next.js, and an Arduino component for controlling the door operations.

## Project Structure

```
smart-door-system
├── backend                # Backend API using FastAPI
│   ├── src
│   │   ├── main.py       # Entry point for the FastAPI application
│   │   ├── api           # API routes and WebSocket management
│   │   ├── services      # Business logic for facial recognition, camera, and Firebase
│   │   ├── models        # Data models for the application
│   │   └── utils         # Utility functions and configuration
│   ├── requirements.txt   # Python dependencies
│   └── .env.example       # Example environment variables
├── frontend               # Frontend application using Next.js
│   ├── src
│   │   ├── app           # Main application components
│   │   ├── components     # Reusable components for camera and visitor log
│   │   ├── hooks         # Custom hooks for WebSocket management
│   │   └── lib           # Firebase integration
│   ├── package.json       # NPM dependencies
│   ├── next.config.js     # Next.js configuration
│   └── tsconfig.json      # TypeScript configuration
├── arduino                # Arduino code for NodeMCU 8266
│   ├── smart_door_controller
│   │   └── smart_door_controller.ino # Code for managing door operations
│   └── libraries
│       └── config.h      # Configuration settings for Arduino
├── firebase               # Firebase configuration
│   └── firebase-config.json.example # Example Firebase configuration
└── README.md              # Project documentation
```

## Features

- **Facial Recognition**: Uses AI to recognize visitors and manage access.
- **Webcam Feed**: Streams video from selected cameras to the frontend.
- **Visitor Log**: Maintains a log of visitors with timestamps and images.
- **Real-time Updates**: Utilizes WebSockets for live updates on visitor logs and camera feeds.
- **Firebase Integration**: Stores visitor information and logs in Firebase.

## Setup Instructions

1. **Clone the repository**:

   ```
   git clone <repository-url>
   cd smart-door-system
   ```

2. **Backend Setup**:

   - Navigate to the `backend` directory.
   - Install dependencies:
     ```
     pip install -r requirements.txt
     ```
   - Configure environment variables by copying `.env.example` to `.env` and filling in the required values.
   - Run the FastAPI application:
     ```
     uvicorn src.main:app --reload
     ```

3. **Frontend Setup**:

   - Navigate to the `frontend` directory.
   - Install dependencies:
     ```
     npm install
     ```
   - Start the Next.js application:
     ```
     npm run dev
     ```

4. **Arduino Setup**:
   - Open `smart_door_controller.ino` in the Arduino IDE.
   - Configure Wi-Fi and Firebase settings in `config.h`.
   - Upload the code to the NodeMCU 8266.

## Usage

- Access the frontend application in your browser to view the webcam feed and visitor log.
- The system will automatically recognize visitors and log their information.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

### How to Contribute

1. **Fork the repository**  
   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**

   ```
   git clone <your-fork-url>
   cd smart-door-system
   ```

3. **Create a new branch for your feature or fix**

   ```
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes**

   - Follow the project structure and coding conventions.
   - Add comments and documentation where necessary.
   - If you add new features, update the README.md accordingly.

5. **Test your changes**

   - Run the backend and frontend locally to ensure everything works.
   - Add unit tests if possible.

6. **Commit your changes**

   ```
   git add .
   git commit -m "Add: your feature or fix description"
   ```

7. **Push your branch to your fork**

   ```
   git push origin feature/your-feature-name
   ```

8. **Open a Pull Request**

   - Go to the original repository on GitHub.
   - Click "Compare & pull request".
   - Fill in the PR template, describe your changes clearly, and reference any related issues.

9. **Code Review**

   - Respond to feedback from maintainers.
   - Make any requested changes and push them to your branch.

10. **Merge**
    - Once approved, your PR will be merged!

### Coding Guidelines

- Use clear, descriptive commit messages.
- Keep pull requests focused and small.
- Write clean, readable code and follow the existing style.
- Document any new APIs or configuration changes.
- Test your code before submitting.

### Contact

If you have questions or need help, feel free to open an issue or contact the maintainers.

## License

This project is licensed under the MIT License.
