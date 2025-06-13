// Flutter Mobile App Authentication Implementation
// Add this to your Flutter app's authentication service

import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class MobileAppAuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Check if user has mobile app permission
  Future<bool> checkMobileAppPermission(User firebaseUser) async {
    try {
      DocumentSnapshot userDoc = await _firestore
          .collection('users')
          .doc(firebaseUser.uid)
          .get();
      
      if (!userDoc.exists) {
        return false;
      }
      
      Map<String, dynamic>? userData = userDoc.data() as Map<String, dynamic>?;
      
      // Check if user has mobile app access
      bool hasMobileAccess = userData?['mobileAppAccess'] ?? false;
      bool isActive = userData?['isActive'] ?? false;
      String status = userData?['status'] ?? 'pending';
      
      // User must have web access AND mobile access
      return hasMobileAccess && isActive && status == 'approved';
      
    } catch (e) {
      print('Error checking mobile app permission: $e');
      return false;
    }
  }

  // Enhanced sign in with mobile app permission check
  Future<UserCredential?> signInWithEmailAndPassword(String email, String password) async {
    try {
      UserCredential userCredential = await _auth.signInWithEmailAndPassword(
        email: email, 
        password: password
      );
      
      User? firebaseUser = userCredential.user;
      if (firebaseUser != null) {
        bool hasMobilePermission = await checkMobileAppPermission(firebaseUser);
        
        if (!hasMobilePermission) {
          // Sign out the user and throw error
          await _auth.signOut();
          throw Exception('You do not have permission to access the mobile app. Please contact your administrator.');
        }
        
        // User has both web and mobile permissions - proceed
        return userCredential;
      }
      
      return null;
    } catch (e) {
      // Re-throw the error to be handled by the UI
      rethrow;
    }
  }

  // Get user details including mobile app permission status
  Future<Map<String, dynamic>?> getUserDetails(String uid) async {
    try {
      DocumentSnapshot userDoc = await _firestore
          .collection('users')
          .doc(uid)
          .get();
      
      if (userDoc.exists) {
        return userDoc.data() as Map<String, dynamic>;
      }
      
      return null;
    } catch (e) {
      print('Error getting user details: $e');
      return null;
    }
  }

  // Listen to real-time permission changes
  Stream<bool> listenToMobileAppPermission(String uid) {
    return _firestore
        .collection('users')
        .doc(uid)
        .snapshots()
        .map((snapshot) {
      if (snapshot.exists) {
        Map<String, dynamic>? data = snapshot.data() as Map<String, dynamic>?;
        bool hasMobileAccess = data?['mobileAppAccess'] ?? false;
        bool isActive = data?['isActive'] ?? false;
        String status = data?['status'] ?? 'pending';
        
        return hasMobileAccess && isActive && status == 'approved';
      }
      return false;
    });
  }

  // Sign out
  Future<void> signOut() async {
    await _auth.signOut();
  }
}

// Usage in your login screen widget
class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final MobileAppAuthService _authService = MobileAppAuthService();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isLoading = false;

  Future<void> _signIn() async {
    setState(() {
      _isLoading = true;
    });

    try {
      UserCredential? userCredential = await _authService.signInWithEmailAndPassword(
        _emailController.text.trim(),
        _passwordController.text.trim(),
      );

      if (userCredential != null) {
        // Navigate to home screen
        Navigator.pushReplacementNamed(context, '/home');
      }
    } catch (e) {
      // Show error message
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Login')),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _emailController,
              decoration: InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            SizedBox(height: 16),
            TextField(
              controller: _passwordController,
              decoration: InputDecoration(labelText: 'Password'),
              obscureText: true,
            ),
            SizedBox(height: 24),
            _isLoading
                ? CircularProgressIndicator()
                : ElevatedButton(
                    onPressed: _signIn,
                    child: Text('Sign In'),
                  ),
          ],
        ),
      ),
    );
  }
}

// Main app wrapper with permission monitoring
class AppWrapper extends StatefulWidget {
  @override
  _AppWrapperState createState() => _AppWrapperState();
}

class _AppWrapperState extends State<AppWrapper> {
  final MobileAppAuthService _authService = MobileAppAuthService();
  User? _user;
  bool _hasMobilePermission = false;

  @override
  void initState() {
    super.initState();
    
    // Listen to auth state changes
    FirebaseAuth.instance.authStateChanges().listen((User? user) {
      setState(() {
        _user = user;
      });
      
      if (user != null) {
        // Listen to permission changes
        _authService.listenToMobileAppPermission(user.uid).listen((hasPermission) {
          setState(() {
            _hasMobilePermission = hasPermission;
          });
          
          // If permission is revoked while user is logged in, sign them out
          if (!hasPermission && _user != null) {
            _authService.signOut();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Your mobile app access has been revoked. Please contact your administrator.'),
                backgroundColor: Colors.red,
              ),
            );
          }
        });
      } else {
        setState(() {
          _hasMobilePermission = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_user == null) {
      return LoginScreen();
    } else if (!_hasMobilePermission) {
      return NoPermissionScreen();
    } else {
      return HomeScreen(); // Your main app screen
    }
  }
}

// Screen shown when user doesn't have mobile app permission
class NoPermissionScreen extends StatelessWidget {
  final MobileAppAuthService _authService = MobileAppAuthService();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.mobile_off,
                size: 64,
                color: Colors.grey,
              ),
              SizedBox(height: 24),
              Text(
                'Mobile App Access Required',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: 16),
              Text(
                'You do not have permission to access the mobile app. Please contact your administrator to grant mobile app access.',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey[600],
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: 32),
              ElevatedButton(
                onPressed: () async {
                  await _authService.signOut();
                },
                child: Text('Sign Out'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Your existing HomeScreen widget
class HomeScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Home')),
      body: Center(
        child: Text('Welcome to the mobile app!'),
      ),
    );
  }
} 