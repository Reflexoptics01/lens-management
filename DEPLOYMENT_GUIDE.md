# Production Deployment & Management Guide

## 🚀 Deployment Workflow

### Environment Setup
Create separate Firebase projects for different environments:
- **Production**: `lens-management-prod`
- **Staging**: `lens-management-staging`
- **Development**: `lens-management-dev`

### Netlify Environment Variables
Configure in Netlify Dashboard → Site Settings → Environment Variables:

**Production:**
```
REACT_APP_FIREBASE_API_KEY=your_production_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=lens-management-prod.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=lens-management-prod
REACT_APP_FIREBASE_STORAGE_BUCKET=lens-management-prod.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=your_production_app_id
REACT_APP_ENV=production
```

## 📦 Update Deployment Process

### 1. Feature Development
```bash
# Create feature branch
git checkout -b feature/description
# Make changes, test locally
npm start
# Commit and push
git add .
git commit -m "feat: description of feature"
git push origin feature/description
# Create Pull Request
```

### 2. Bug Fixes
```bash
# Hot fix for production
git checkout main
git checkout -b hotfix/description
# Fix issue
git add .
git commit -m "fix: description of fix"
git checkout main
git merge hotfix/description
git push origin main  # Auto-deploys to production
```

### 3. Scheduled Releases
```bash
# Weekly releases from develop to main
git checkout main
git merge develop
git tag v1.2.3
git push origin main --tags
```

## 👥 User Management Strategy

### 1. Firebase Authentication Setup
- **Email/Password**: Primary method
- **Google Sign-in**: Optional for ease of use
- **Admin Controls**: Manual user approval

### 2. User Roles & Permissions
```javascript
// User roles in Firestore
const userRoles = {
  SUPER_ADMIN: 'super_admin',    // Full system access
  ADMIN: 'admin',                // Manage users, view all data
  MANAGER: 'manager',            // View all, limited edit
  STAFF: 'staff',                // Limited access
  VIEWER: 'viewer'               // Read-only access
}
```

### 3. User Onboarding Process
1. **Registration**: User signs up
2. **Approval**: Admin approves new users
3. **Role Assignment**: Admin assigns appropriate role
4. **Training**: Provide user documentation

### 4. Firebase Security Rules
```javascript
// Firestore rules for multi-tenancy
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Admin access
    match /{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
    }
  }
}
```

## 🔒 Production Security

### 1. Backup Strategy
- **Firestore**: Enable automatic backups
- **Code**: Git repository (already done)
- **Environment**: Document all configurations

### 2. Monitoring Setup
```javascript
// Add to your app
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getPerformance } from 'firebase/performance';

const analytics = getAnalytics(app);
const perf = getPerformance(app);
```

### 3. Error Tracking
Consider adding Sentry for error tracking:
```bash
npm install @sentry/react
```

## 📊 User Management Dashboard

### Daily Tasks:
1. **Monitor user activity** (Firebase Analytics)
2. **Review error logs** (Browser console, Firebase)
3. **Check system performance** (Netlify Analytics)

### Weekly Tasks:
1. **Review new user requests**
2. **Update user permissions if needed**
3. **Deploy tested features from develop to main**
4. **Review security alerts**

### Monthly Tasks:
1. **Full system backup verification**
2. **Security audit**
3. **Performance optimization**
4. **User feedback collection**

## 🚨 Emergency Procedures

### Quick Rollback:
```bash
# If something breaks in production
git log --oneline  # Find last good commit
git checkout main
git reset --hard COMMIT_HASH
git push origin main --force
```

### Database Emergency:
1. Check Firebase console for issues
2. Restore from latest backup if needed
3. Inform users of any data issues

## 📈 Scaling Considerations

### When to Scale:
- More than 100 concurrent users
- Database queries getting slow
- Storage approaching limits

### Scaling Options:
1. **Firestore**: Automatic scaling
2. **Netlify**: Upgrade plan for more bandwidth
3. **CDN**: Consider adding for global users

## 🔐 User Access Management

### Adding New Users:
1. User registers in the app
2. Admin receives notification (implement this feature)
3. Admin approves and assigns role
4. User gets access confirmation

### Removing Users:
1. Disable in Firebase Auth
2. Update Firestore user document
3. Inform team of user removal

### Regular Audits:
- Monthly review of active users
- Quarterly security permission review
- Annual complete access audit

## 📱 Mobile Responsiveness
Your app is already mobile-responsive. Monitor mobile usage through:
- Netlify Analytics
- Firebase Analytics
- User feedback

## 🚀 Performance Optimization

### Code Splitting:
```javascript
// Implement lazy loading for routes
const LazyPurchases = lazy(() => import('./pages/Purchases'));
```

### Image Optimization:
- Use WebP format when possible
- Implement lazy loading for images
- Compress images before upload

## 📞 Support & Maintenance

### User Support:
1. Create documentation/FAQ
2. Set up support email
3. Monitor user feedback
4. Regular training sessions

### Maintenance Schedule:
- **Daily**: Monitor alerts
- **Weekly**: Deploy updates
- **Monthly**: Security review
- **Quarterly**: Performance audit
- **Annually**: Complete system review

---

## Quick Command Reference

```bash
# Check current deployment
netlify status

# View recent deployments
netlify sites:list

# Deploy specific branch to preview
netlify deploy --dir=build --alias=preview

# Production deployment
git push origin main  # Auto-deploys via Netlify

# Check build status
netlify open:admin
``` 