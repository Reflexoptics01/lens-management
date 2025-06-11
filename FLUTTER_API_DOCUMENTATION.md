# 📱 Lens Management Flutter API Documentation

## 🚀 **OVERVIEW**

This document provides comprehensive API documentation for developing a Flutter Android app for the Lens Management System. The web application uses Firebase as the backend, which provides RESTful APIs and real-time database capabilities perfect for mobile app development.

---

## 🔗 **FIREBASE BACKEND ARCHITECTURE**

### **Database Structure (Firestore)**
```
users/{userUid}/
├── sales/           # Sales transactions
├── customers/       # Customer data
├── lensInventory/   # Lens inventory
├── purchases/       # Purchase orders
├── orders/          # Custom orders
├── transactions/    # Financial transactions
├── settings/        # Shop settings
└── users/          # Team members
```

### **Authentication System**
- **Primary**: Firebase Authentication
- **Multi-tenancy**: Organization-based data isolation
- **User Roles**: Super Admin, Admin, Manager, Staff, Viewer

---

## 🔐 **AUTHENTICATION APIs**

### **1. User Registration**
```dart
// Firebase Auth Registration
Future<UserCredential> registerUser({
  required String email,
  required String password,
  required String businessName,
  required String ownerName,
}) async {
  UserCredential userCredential = await FirebaseAuth.instance
      .createUserWithEmailAndPassword(email: email, password: password);
  
  // Create user profile in Firestore
  await FirebaseFirestore.instance
      .collection('users')
      .doc(userCredential.user!.uid)
      .collection('settings')
      .doc('shopSettings')
      .set({
    'businessName': businessName,
    'ownerName': ownerName,
    'email': email,
    'createdAt': FieldValue.serverTimestamp(),
    'userRole': 'admin',
  });
  
  return userCredential;
}
```

### **2. User Login**
```dart
Future<UserCredential> loginUser({
  required String email,
  required String password,
}) async {
  return await FirebaseAuth.instance
      .signInWithEmailAndPassword(email: email, password: password);
}
```

### **3. Team Member Authentication**
```dart
Future<void> loginAsTeamMember({
  required String email,
  required String password,
  required String organizationId,
}) async {
  UserCredential userCredential = await FirebaseAuth.instance
      .signInWithEmailAndPassword(email: email, password: password);
  
  // Store organization context
  await SharedPreferences.getInstance().then((prefs) {
    prefs.setString('organizationId', organizationId);
    prefs.setString('userRole', 'team_member');
  });
}
```

---

## 👥 **CUSTOMER MANAGEMENT APIs**

### **1. Create Customer**
```dart
Future<String> createCustomer({
  required String name,
  required String phone,
  String? email,
  String? address,
  Map<String, dynamic>? prescription,
}) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  DocumentReference docRef = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('customers')
      .add({
    'name': name,
    'phone': phone,
    'email': email,
    'address': address,
    'prescription': prescription,
    'createdAt': FieldValue.serverTimestamp(),
    'updatedAt': FieldValue.serverTimestamp(),
  });
  
  return docRef.id;
}
```

### **2. Get Customers**
```dart
Stream<List<Customer>> getCustomers() {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  return FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('customers')
      .orderBy('name')
      .snapshots()
      .map((snapshot) => snapshot.docs
          .map((doc) => Customer.fromFirestore(doc))
          .toList());
}
```

### **3. Search Customers**
```dart
Future<List<Customer>> searchCustomers(String query) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  // Search by name
  QuerySnapshot nameQuery = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('customers')
      .where('name', isGreaterThanOrEqualTo: query)
      .where('name', isLessThanOrEqualTo: query + '\uf8ff')
      .get();
  
  // Search by phone
  QuerySnapshot phoneQuery = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('customers')
      .where('phone', isGreaterThanOrEqualTo: query)
      .where('phone', isLessThanOrEqualTo: query + '\uf8ff')
      .get();
  
  List<Customer> customers = [];
  customers.addAll(nameQuery.docs.map((doc) => Customer.fromFirestore(doc)));
  customers.addAll(phoneQuery.docs.map((doc) => Customer.fromFirestore(doc)));
  
  // Remove duplicates
  return customers.toSet().toList();
}
```

---

## 🛒 **SALES MANAGEMENT APIs**

### **1. Create Sale**
```dart
Future<String> createSale({
  required String customerId,
  required String customerName,
  required List<SaleItem> items,
  required double totalAmount,
  required double amountPaid,
  String paymentMethod = 'cash',
  double discount = 0,
  double freightCharge = 0,
}) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  // Generate invoice number
  String invoiceNumber = await generateInvoiceNumber();
  
  DocumentReference docRef = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('sales')
      .add({
    'invoiceNumber': invoiceNumber,
    'customerId': customerId,
    'customerName': customerName,
    'items': items.map((item) => item.toMap()).toList(),
    'totalAmount': totalAmount,
    'amountPaid': amountPaid,
    'balanceAmount': totalAmount - amountPaid,
    'paymentMethod': paymentMethod,
    'discount': discount,
    'freightCharge': freightCharge,
    'invoiceDate': FieldValue.serverTimestamp(),
    'paymentStatus': amountPaid >= totalAmount ? 'PAID' : 'PARTIAL',
    'createdAt': FieldValue.serverTimestamp(),
  });
  
  // Update inventory for each item
  await updateInventoryOnSale(items);
  
  return docRef.id;
}
```

### **2. Get Sales**
```dart
Stream<List<Sale>> getSales({
  DateTime? startDate,
  DateTime? endDate,
  String? customerId,
}) {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  Query query = FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('sales');
  
  if (startDate != null) {
    query = query.where('invoiceDate', isGreaterThanOrEqualTo: startDate);
  }
  
  if (endDate != null) {
    query = query.where('invoiceDate', isLessThanOrEqualTo: endDate);
  }
  
  if (customerId != null) {
    query = query.where('customerId', isEqualTo: customerId);
  }
  
  return query
      .orderBy('invoiceDate', descending: true)
      .snapshots()
      .map((snapshot) => snapshot.docs
          .map((doc) => Sale.fromFirestore(doc))
          .toList());
}
```

### **3. Update Sale Payment**
```dart
Future<void> updateSalePayment({
  required String saleId,
  required double additionalPayment,
  String paymentMethod = 'cash',
}) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  DocumentReference saleRef = FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('sales')
      .doc(saleId);
  
  await FirebaseFirestore.instance.runTransaction((transaction) async {
    DocumentSnapshot saleSnapshot = await transaction.get(saleRef);
    
    if (!saleSnapshot.exists) {
      throw Exception('Sale not found');
    }
    
    Map<String, dynamic> saleData = saleSnapshot.data() as Map<String, dynamic>;
    double currentPaid = saleData['amountPaid'] ?? 0;
    double totalAmount = saleData['totalAmount'] ?? 0;
    double newAmountPaid = currentPaid + additionalPayment;
    
    transaction.update(saleRef, {
      'amountPaid': newAmountPaid,
      'balanceAmount': totalAmount - newAmountPaid,
      'paymentStatus': newAmountPaid >= totalAmount ? 'PAID' : 'PARTIAL',
      'updatedAt': FieldValue.serverTimestamp(),
    });
    
    // Add transaction record
    await addTransaction({
      'type': 'received',
      'amount': additionalPayment,
      'paymentMethod': paymentMethod,
      'description': 'Payment for Invoice ${saleData['invoiceNumber']}',
      'relatedSaleId': saleId,
      'date': DateTime.now(),
    });
  });
}
```

---

## 📦 **INVENTORY MANAGEMENT APIs**

### **1. Get Lens Inventory**
```dart
Stream<List<LensInventory>> getLensInventory() {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  return FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('lensInventory')
      .snapshots()
      .map((snapshot) => snapshot.docs
          .map((doc) => LensInventory.fromFirestore(doc))
          .toList());
}
```

### **2. Add Lens to Inventory**
```dart
Future<String> addLensToInventory({
  required String itemName,
  required String type, // 'single', 'stock', 'contact', 'service'
  required int qty,
  required double purchasePrice,
  required double sellingPrice,
  String? brand,
  String? material,
  Map<String, dynamic>? powerInventory,
}) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  DocumentReference docRef = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('lensInventory')
      .add({
    'itemName': itemName,
    'type': type,
    'qty': qty,
    'purchasePrice': purchasePrice,
    'sellingPrice': sellingPrice,
    'brand': brand,
    'material': material,
    'powerInventory': powerInventory,
    'createdAt': FieldValue.serverTimestamp(),
    'updatedAt': FieldValue.serverTimestamp(),
  });
  
  return docRef.id;
}
```

### **3. Update Inventory Quantity**
```dart
Future<void> updateInventoryQuantity({
  required String itemId,
  required int quantityChange, // Positive for addition, negative for subtraction
  String? powerKey, // For stock lenses with specific powers
}) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  DocumentReference itemRef = FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('lensInventory')
      .doc(itemId);
  
  await FirebaseFirestore.instance.runTransaction((transaction) async {
    DocumentSnapshot itemSnapshot = await transaction.get(itemRef);
    
    if (!itemSnapshot.exists) {
      throw Exception('Item not found');
    }
    
    Map<String, dynamic> itemData = itemSnapshot.data() as Map<String, dynamic>;
    
    if (powerKey != null && itemData['powerInventory'] != null) {
      // Update specific power inventory
      Map<String, dynamic> powerInventory = Map<String, dynamic>.from(itemData['powerInventory']);
      int currentQty = powerInventory[powerKey]?['quantity'] ?? 0;
      powerInventory[powerKey] = {
        ...powerInventory[powerKey] ?? {},
        'quantity': currentQty + quantityChange,
      };
      
      transaction.update(itemRef, {
        'powerInventory': powerInventory,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } else {
      // Update general quantity
      int currentQty = itemData['qty'] ?? 0;
      transaction.update(itemRef, {
        'qty': currentQty + quantityChange,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    }
  });
}
```

---

## 📊 **DASHBOARD & ANALYTICS APIs**

### **1. Get Sales Analytics**
```dart
Future<SalesAnalytics> getSalesAnalytics({
  required DateTime selectedDate,
}) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  QuerySnapshot salesSnapshot = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('sales')
      .get();
  
  double todaySales = 0;
  double monthSales = 0;
  double yearSales = 0;
  
  // Calculate analytics from sales data
  // Implementation details...
  
  return SalesAnalytics(
    todaySales: todaySales,
    monthSales: monthSales,
    yearSales: yearSales,
  );
}
```

### **2. Get Top Products**
```dart
Future<List<TopProduct>> getTopProducts({int limit = 20}) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  QuerySnapshot salesSnapshot = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('sales')
      .get();
  
  Map<String, int> productCounts = {};
  
  for (QueryDocumentSnapshot doc in salesSnapshot.docs) {
    Map<String, dynamic> sale = doc.data() as Map<String, dynamic>;
    List<dynamic> items = sale['items'] ?? [];
    
    for (var item in items) {
      // Skip services
      if (item['isService'] == true || item['type'] == 'service') continue;
      
      String productName = item['itemName'] ?? 'Unknown Product';
      int qty = (item['qty'] ?? 1) as int;
      
      productCounts[productName] = (productCounts[productName] ?? 0) + qty;
    }
  }
  
  List<TopProduct> topProducts = productCounts.entries
      .map((entry) => TopProduct(name: entry.key, count: entry.value))
      .toList();
  
  topProducts.sort((a, b) => b.count.compareTo(a.count));
  
  return topProducts.take(limit).toList();
}
```

---

## 💰 **FINANCIAL MANAGEMENT APIs**

### **1. Add Transaction**
```dart
Future<String> addTransaction({
  required String type, // 'received' or 'paid'
  required double amount,
  required String paymentMethod,
  required String description,
  String? customerId,
  String? vendorId,
  String? relatedSaleId,
  DateTime? date,
}) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  DocumentReference docRef = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('transactions')
      .add({
    'type': type,
    'amount': amount,
    'paymentMethod': paymentMethod,
    'description': description,
    'customerId': customerId,
    'vendorId': vendorId,
    'relatedSaleId': relatedSaleId,
    'date': date ?? DateTime.now(),
    'createdAt': FieldValue.serverTimestamp(),
  });
  
  return docRef.id;
}
```

### **2. Get Customer Balance**
```dart
Future<double> getCustomerBalance(String customerId) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  // Get all sales for customer
  QuerySnapshot salesSnapshot = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('sales')
      .where('customerId', isEqualTo: customerId)
      .get();
  
  double totalBalance = 0;
  
  for (QueryDocumentSnapshot doc in salesSnapshot.docs) {
    Map<String, dynamic> sale = doc.data() as Map<String, dynamic>;
    double balanceAmount = (sale['balanceAmount'] ?? 0).toDouble();
    totalBalance += balanceAmount;
  }
  
  return totalBalance;
}
```

---

## 🛍️ **ORDER MANAGEMENT APIs**

### **1. Create Order**
```dart
Future<String> createOrder({
  required String customerId,
  required String customerName,
  required List<OrderItem> items,
  required DateTime deliveryDate,
  String status = 'pending',
  String? notes,
}) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  // Generate order number
  String orderNumber = await generateOrderNumber();
  
  DocumentReference docRef = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('orders')
      .add({
    'orderNumber': orderNumber,
    'customerId': customerId,
    'customerName': customerName,
    'items': items.map((item) => item.toMap()).toList(),
    'deliveryDate': deliveryDate,
    'status': status,
    'notes': notes,
    'createdAt': FieldValue.serverTimestamp(),
    'updatedAt': FieldValue.serverTimestamp(),
  });
  
  return docRef.id;
}
```

### **2. Update Order Status**
```dart
Future<void> updateOrderStatus({
  required String orderId,
  required String status,
  String? notes,
}) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('orders')
      .doc(orderId)
      .update({
    'status': status,
    'notes': notes,
    'updatedAt': FieldValue.serverTimestamp(),
  });
}
```

---

## 🔍 **SEARCH & FILTER APIs**

### **1. Universal Search**
```dart
Future<SearchResults> universalSearch(String query) async {
  String userUid = FirebaseAuth.instance.currentUser!.uid;
  
  // Search customers
  List<Customer> customers = await searchCustomers(query);
  
  // Search products in inventory
  QuerySnapshot inventorySnapshot = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('lensInventory')
      .where('itemName', isGreaterThanOrEqualTo: query)
      .where('itemName', isLessThanOrEqualTo: query + '\uf8ff')
      .get();
  
  List<LensInventory> products = inventorySnapshot.docs
      .map((doc) => LensInventory.fromFirestore(doc))
      .toList();
  
  // Search sales by invoice number
  QuerySnapshot salesSnapshot = await FirebaseFirestore.instance
      .collection('users')
      .doc(userUid)
      .collection('sales')
      .where('invoiceNumber', isGreaterThanOrEqualTo: query)
      .where('invoiceNumber', isLessThanOrEqualTo: query + '\uf8ff')
      .get();
  
  List<Sale> sales = salesSnapshot.docs
      .map((doc) => Sale.fromFirestore(doc))
      .toList();
  
  return SearchResults(
    customers: customers,
    products: products,
    sales: sales,
  );
}
```

---

## 📱 **OFFLINE SUPPORT APIs**

### **1. Enable Offline Persistence**
```dart
void enableOfflinePersistence() {
  FirebaseFirestore.instance.enablePersistence();
}
```

### **2. Sync Data When Online**
```dart
Stream<ConnectivityResult> monitorConnectivity() {
  return Connectivity().onConnectivityChanged;
}

Future<void> syncPendingChanges() async {
  // Force sync pending writes
  await FirebaseFirestore.instance.waitForPendingWrites();
}
```

---

## 🛡️ **SECURITY & VALIDATION**

### **1. Input Validation**
```dart
class ValidationHelper {
  static String? validateEmail(String? email) {
    if (email == null || email.isEmpty) {
      return 'Email is required';
    }
    
    RegExp emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
    if (!emailRegex.hasMatch(email)) {
      return 'Please enter a valid email';
    }
    
    return null;
  }
  
  static String? validatePhone(String? phone) {
    if (phone == null || phone.isEmpty) {
      return 'Phone number is required';
    }
    
    RegExp phoneRegex = RegExp(r'^[6-9]\d{9}$');
    if (!phoneRegex.hasMatch(phone)) {
      return 'Please enter a valid Indian phone number';
    }
    
    return null;
  }
  
  static String? validateAmount(String? amount) {
    if (amount == null || amount.isEmpty) {
      return 'Amount is required';
    }
    
    double? parsedAmount = double.tryParse(amount);
    if (parsedAmount == null || parsedAmount < 0) {
      return 'Please enter a valid amount';
    }
    
    return null;
  }
}
```

### **2. Error Handling**
```dart
class ApiException implements Exception {
  final String message;
  final String? code;
  
  ApiException(this.message, {this.code});
  
  @override
  String toString() => 'ApiException: $message';
}

class FirebaseApiHelper {
  static Future<T> handleApiCall<T>(Future<T> Function() apiCall) async {
    try {
      return await apiCall();
    } on FirebaseAuthException catch (e) {
      throw ApiException(_getAuthErrorMessage(e.code), code: e.code);
    } on FirebaseException catch (e) {
      throw ApiException(_getFirestoreErrorMessage(e.code), code: e.code);
    } catch (e) {
      throw ApiException('An unexpected error occurred: $e');
    }
  }
  
  static String _getAuthErrorMessage(String code) {
    switch (code) {
      case 'user-not-found':
        return 'No user found with this email address';
      case 'wrong-password':
        return 'Incorrect password';
      case 'email-already-in-use':
        return 'An account already exists with this email';
      case 'weak-password':
        return 'Password is too weak';
      case 'invalid-email':
        return 'Invalid email address';
      default:
        return 'Authentication error: $code';
    }
  }
  
  static String _getFirestoreErrorMessage(String code) {
    switch (code) {
      case 'permission-denied':
        return 'You do not have permission to perform this action';
      case 'unavailable':
        return 'Service is currently unavailable. Please try again later';
      case 'deadline-exceeded':
        return 'Request timeout. Please check your internet connection';
      default:
        return 'Database error: $code';
    }
  }
}
```

---

## 📄 **DATA MODELS**

### **Customer Model**
```dart
class Customer {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final String? address;
  final Map<String, dynamic>? prescription;
  final DateTime createdAt;
  final DateTime updatedAt;
  
  Customer({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.address,
    this.prescription,
    required this.createdAt,
    required this.updatedAt,
  });
  
  factory Customer.fromFirestore(DocumentSnapshot doc) {
    Map<String, dynamic> data = doc.data() as Map<String, dynamic>;
    return Customer(
      id: doc.id,
      name: data['name'] ?? '',
      phone: data['phone'] ?? '',
      email: data['email'],
      address: data['address'],
      prescription: data['prescription'],
      createdAt: (data['createdAt'] as Timestamp).toDate(),
      updatedAt: (data['updatedAt'] as Timestamp).toDate(),
    );
  }
  
  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'phone': phone,
      'email': email,
      'address': address,
      'prescription': prescription,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }
}
```

### **Sale Model**
```dart
class Sale {
  final String id;
  final String invoiceNumber;
  final String customerId;
  final String customerName;
  final List<SaleItem> items;
  final double totalAmount;
  final double amountPaid;
  final double balanceAmount;
  final String paymentMethod;
  final double discount;
  final double freightCharge;
  final DateTime invoiceDate;
  final String paymentStatus;
  
  Sale({
    required this.id,
    required this.invoiceNumber,
    required this.customerId,
    required this.customerName,
    required this.items,
    required this.totalAmount,
    required this.amountPaid,
    required this.balanceAmount,
    required this.paymentMethod,
    required this.discount,
    required this.freightCharge,
    required this.invoiceDate,
    required this.paymentStatus,
  });
  
  factory Sale.fromFirestore(DocumentSnapshot doc) {
    Map<String, dynamic> data = doc.data() as Map<String, dynamic>;
    return Sale(
      id: doc.id,
      invoiceNumber: data['invoiceNumber'] ?? '',
      customerId: data['customerId'] ?? '',
      customerName: data['customerName'] ?? '',
      items: (data['items'] as List<dynamic>?)
          ?.map((item) => SaleItem.fromMap(item))
          .toList() ?? [],
      totalAmount: (data['totalAmount'] ?? 0).toDouble(),
      amountPaid: (data['amountPaid'] ?? 0).toDouble(),
      balanceAmount: (data['balanceAmount'] ?? 0).toDouble(),
      paymentMethod: data['paymentMethod'] ?? 'cash',
      discount: (data['discount'] ?? 0).toDouble(),
      freightCharge: (data['freightCharge'] ?? 0).toDouble(),
      invoiceDate: (data['invoiceDate'] as Timestamp).toDate(),
      paymentStatus: data['paymentStatus'] ?? 'UNPAID',
    );
  }
}
```

### **SaleItem Model**
```dart
class SaleItem {
  final String itemName;
  final int qty;
  final double price;
  final double? sph;
  final double? cyl;
  final int? axis;
  final double? add;
  final bool isService;
  final String? eye; // 'left', 'right', 'both'
  
  SaleItem({
    required this.itemName,
    required this.qty,
    required this.price,
    this.sph,
    this.cyl,
    this.axis,
    this.add,
    this.isService = false,
    this.eye,
  });
  
  factory SaleItem.fromMap(Map<String, dynamic> data) {
    return SaleItem(
      itemName: data['itemName'] ?? '',
      qty: data['qty'] ?? 1,
      price: (data['price'] ?? 0).toDouble(),
      sph: data['sph']?.toDouble(),
      cyl: data['cyl']?.toDouble(),
      axis: data['axis']?.toInt(),
      add: data['add']?.toDouble(),
      isService: data['isService'] ?? false,
      eye: data['eye'],
    );
  }
  
  Map<String, dynamic> toMap() {
    return {
      'itemName': itemName,
      'qty': qty,
      'price': price,
      'sph': sph,
      'cyl': cyl,
      'axis': axis,
      'add': add,
      'isService': isService,
      'eye': eye,
    };
  }
}
```

---

## 🚀 **GETTING STARTED**

### **1. Firebase Setup**
```yaml
# pubspec.yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_auth: ^4.15.3
  cloud_firestore: ^4.13.6
  firebase_storage: ^11.6.0
```

### **2. Initialize Firebase**
```dart
// main.dart
import 'package:firebase_core/firebase_core.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(MyApp());
}
```

### **3. API Service Layer**
```dart
class ApiService {
  static final FirebaseAuth _auth = FirebaseAuth.instance;
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  static String get _userUid {
    User? user = _auth.currentUser;
    if (user == null) {
      throw ApiException('User not authenticated');
    }
    return user.uid;
  }
  
  static CollectionReference _getUserCollection(String collectionName) {
    return _firestore
        .collection('users')
        .doc(_userUid)
        .collection(collectionName);
  }
  
  // Add all the API methods here...
}
```

This comprehensive API documentation provides everything you need to develop the Flutter Android app with full feature parity to your web application. 