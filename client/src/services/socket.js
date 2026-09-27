import { io } from 'socket.io-client'

class SocketService {
    constructor() {
        this.socket = null
        this.isConnected = false
    }

    connect() {
        if (!this.socket) {
            this.socket = io('http://localhost:5000', {
                autoConnect: false,
                transports: ['websocket', 'polling']
            })

            this.socket.on('connect', () => {
                console.log('Connected to server')
                this.isConnected = true
            })

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server')
                this.isConnected = false
            })

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error)
            })
        }

        this.socket.connect()
        return this.socket
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect()
            this.isConnected = false
        }
    }

    // Join user-specific room for notifications
    joinUserRoom(userId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('join', userId)
        }
    }

    // Join company-specific room
    joinCompanyRoom(companyId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('join_company', companyId)
        }
    }

    // Listen for application status updates
    onApplicationStatusUpdate(callback) {
        if (this.socket) {
            this.socket.on('application_status_updated', callback)
        }
    }

    // Listen for new job postings
    onNewJobPosting(callback) {
        if (this.socket) {
            this.socket.on('new_job_posted', callback)
        }
    }

    // Listen for new applications
    onNewApplication(callback) {
        if (this.socket) {
            this.socket.on('new_application', callback)
        }
    }

    // Listen for general notifications
    onNotification(callback) {
        if (this.socket) {
            this.socket.on('notification', callback)
        }
    }

    // Remove listeners
    removeAllListeners() {
        if (this.socket) {
            this.socket.removeAllListeners()
        }
    }

    // Get connection status
    isSocketConnected() {
        return this.isConnected && this.socket?.connected
    }
}

// Create a singleton instance
const socketService = new SocketService()

export default socketService