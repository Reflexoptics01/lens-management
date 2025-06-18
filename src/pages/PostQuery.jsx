import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { getUserCollection } from '../utils/multiTenancy';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const PostQuery = ({ hideNavbar = false }) => {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState('lens-search');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'lens-search',
    priority: 'medium',
    budget: '',
    quantity: '',
    timeline: '',
    contactPreference: 'email',
    specifications: {}
  });
  const [loading, setLoading] = useState(false);

  const queryTemplates = [
    {
      id: 'lens-search',
      title: 'Lens Search',
      icon: '🔍',
      description: 'Find specific lenses with detailed specifications',
      color: 'blue'
    },
    {
      id: 'price-request',
      title: 'Price Request',
      icon: '💰',
      description: 'Get quotes for bulk orders or specific products',
      color: 'green'
    },
    {
      id: 'optical-accessories',
      title: 'Optical Accessories',
      icon: '🛠️',
      description: 'Find frames, tools, cases, and other optical equipment',
      color: 'purple'
    },
    {
      id: 'information-request',
      title: 'Information Request',
      icon: '❓',
      description: 'Ask questions about products, services, or industry info',
      color: 'orange'
    }
  ];

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    setFormData(prev => ({
      ...prev,
      category: templateId,
      specifications: {}
    }));
  };

  const handleInputChange = (field, value) => {
    if (field.startsWith('specifications.')) {
      const specField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        specifications: {
          ...prev.specifications,
          [specField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.title.trim()) {
        throw new Error('Query title is required');
      }

      if (!formData.description.trim()) {
        throw new Error('Query description is required');
      }

      const queryData = {
        ...formData,
        userId: user?.uid,
        userEmail: user?.email,
        userName: user?.displayName || user?.email,
        status: 'open',
        createdAt: new Date(),
        responses: [],
        views: 0
      };

      const queriesRef = getUserCollection('marketplaceQueries');
      await addDoc(queriesRef, queryData);

      toast.success('Query posted successfully!');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        category: selectedTemplate,
        priority: 'medium',
        budget: '',
        quantity: '',
        timeline: '',
        contactPreference: 'email',
        specifications: {}
      });

    } catch (error) {
      console.error('Error posting query:', error);
      toast.error(error.message || 'Failed to post query');
    } finally {
      setLoading(false);
    }
  };

  const renderTemplateForm = () => {
    switch (selectedTemplate) {
      case 'lens-search':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sphere (SPH)
                </label>
                <input
                  type="text"
                  value={formData.specifications.sph || ''}
                  onChange={(e) => handleInputChange('specifications.sph', e.target.value)}
                  placeholder="e.g., -2.00, +1.50"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cylinder (CYL)
                </label>
                <input
                  type="text"
                  value={formData.specifications.cyl || ''}
                  onChange={(e) => handleInputChange('specifications.cyl', e.target.value)}
                  placeholder="e.g., -0.75, +0.50"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Axis
                </label>
                <input
                  type="text"
                  value={formData.specifications.axis || ''}
                  onChange={(e) => handleInputChange('specifications.axis', e.target.value)}
                  placeholder="e.g., 90, 180"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Material
                </label>
                <select
                  value={formData.specifications.material || ''}
                  onChange={(e) => handleInputChange('specifications.material', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select Material</option>
                  <option value="cr39">CR-39</option>
                  <option value="polycarbonate">Polycarbonate</option>
                  <option value="trivex">Trivex</option>
                  <option value="high-index">High Index</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Refractive Index
                </label>
                <select
                  value={formData.specifications.index || ''}
                  onChange={(e) => handleInputChange('specifications.index', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select Index</option>
                  <option value="1.50">1.50</option>
                  <option value="1.56">1.56</option>
                  <option value="1.61">1.61</option>
                  <option value="1.67">1.67</option>
                  <option value="1.74">1.74</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Coating
                </label>
                <select
                  value={formData.specifications.coating || ''}
                  onChange={(e) => handleInputChange('specifications.coating', e.target.value)}
                  className="form-input"
                >
                  <option value="">Select Coating</option>
                  <option value="anti-reflective">Anti-Reflective</option>
                  <option value="scratch-resistant">Scratch Resistant</option>
                  <option value="uv-protection">UV Protection</option>
                  <option value="blue-light">Blue Light Filter</option>
                  <option value="photochromic">Photochromic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Diameter (mm)
                </label>
                <input
                  type="text"
                  value={formData.specifications.diameter || ''}
                  onChange={(e) => handleInputChange('specifications.diameter', e.target.value)}
                  placeholder="e.g., 70, 75"
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Color/Tint
                </label>
                <input
                  type="text"
                  value={formData.specifications.color || ''}
                  onChange={(e) => handleInputChange('specifications.color', e.target.value)}
                  placeholder="e.g., Clear, Gray, Brown"
                  className="form-input"
                />
              </div>
            </div>
          </div>
        );

      case 'price-request':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Product Category
                </label>
                <select
                  value={formData.specifications.category || ''}
                  onChange={(e) => handleInputChange('specifications.category', e.target.value)}
                  className="form-input"
                >
                  <option value="">Select Category</option>
                  <option value="prescription-lenses">Prescription Lenses</option>
                  <option value="contact-lenses">Contact Lenses</option>
                  <option value="frames">Frames</option>
                  <option value="sunglasses">Sunglasses</option>
                  <option value="accessories">Accessories</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Brand Preference
                </label>
                <input
                  type="text"
                  value={formData.specifications.brand || ''}
                  onChange={(e) => handleInputChange('specifications.brand', e.target.value)}
                  placeholder="e.g., Essilor, Zeiss, Hoya"
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Quantity Range
                </label>
                <input
                  type="text"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', e.target.value)}
                  placeholder="e.g., 50-100 pairs"
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Budget Range (₹)
                </label>
                <input
                  type="text"
                  value={formData.budget}
                  onChange={(e) => handleInputChange('budget', e.target.value)}
                  placeholder="e.g., 10,000 - 50,000"
                  className="form-input"
                />
              </div>
            </div>
          </div>
        );

      case 'optical-accessories':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Accessory Type
                </label>
                <select
                  value={formData.specifications.accessoryType || ''}
                  onChange={(e) => handleInputChange('specifications.accessoryType', e.target.value)}
                  className="form-input"
                >
                  <option value="">Select Type</option>
                  <option value="frames">Spectacle Frames</option>
                  <option value="cases">Cases & Pouches</option>
                  <option value="cleaning">Cleaning Supplies</option>
                  <option value="tools">Optical Tools</option>
                  <option value="machinery">Optical Machinery</option>
                  <option value="display">Display Equipment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Material Preference
                </label>
                <input
                  type="text"
                  value={formData.specifications.material || ''}
                  onChange={(e) => handleInputChange('specifications.material', e.target.value)}
                  placeholder="e.g., Titanium, Acetate, Metal"
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Size/Dimensions
                </label>
                <input
                  type="text"
                  value={formData.specifications.size || ''}
                  onChange={(e) => handleInputChange('specifications.size', e.target.value)}
                  placeholder="e.g., 52-18-140, Medium, Large"
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Color Preference
                </label>
                <input
                  type="text"
                  value={formData.specifications.color || ''}
                  onChange={(e) => handleInputChange('specifications.color', e.target.value)}
                  placeholder="e.g., Black, Brown, Silver"
                  className="form-input"
                />
              </div>
            </div>
          </div>
        );

      case 'information-request':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Information Category
              </label>
              <select
                value={formData.specifications.infoCategory || ''}
                onChange={(e) => handleInputChange('specifications.infoCategory', e.target.value)}
                className="form-input"
              >
                <option value="">Select Category</option>
                <option value="product-info">Product Information</option>
                <option value="technical-specs">Technical Specifications</option>
                <option value="compatibility">Compatibility Questions</option>
                <option value="industry-trends">Industry Trends</option>
                <option value="training">Training & Education</option>
                <option value="regulations">Regulations & Standards</option>
              </select>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Popular Questions:</h4>
              <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                <p>• What's the difference between CR-39 and polycarbonate lenses?</p>
                <p>• How do I choose the right lens index for my prescription?</p>
                <p>• What are the latest trends in frame materials?</p>
                <p>• How do I properly clean and maintain optical equipment?</p>
                <p>• What certifications are required for optical products?</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Post Your Query
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Connect with verified distributors and get exactly what you need. Choose a template below to get started.
          </p>
        </div>

        {/* Main Layout - Vertical Left Sidebar */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Sidebar - Query Type Selection */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden sticky top-8">
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Choose Query Type</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select your query category</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-3">
                  {queryTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateChange(template.id)}
                      className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        selectedTemplate === template.id
                          ? `border-${template.color}-500 bg-${template.color}-50 dark:bg-${template.color}-900/20`
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="text-2xl">{template.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{template.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{template.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Basic Information and Template Form */}
          <div className="flex-1">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Basic Information</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fill in the details for your query</p>
                </div>
                
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Query Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Brief, descriptive title for your query"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Detailed Description *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Provide detailed information about what you're looking for..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Priority
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => handleInputChange('priority', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Timeline
                      </label>
                      <select
                        value={formData.timeline}
                        onChange={(e) => handleInputChange('timeline', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Select Timeline</option>
                        <option value="immediate">Immediate (1-2 days)</option>
                        <option value="week">Within a week</option>
                        <option value="month">Within a month</option>
                        <option value="flexible">Flexible</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Contact Preference
                      </label>
                      <select
                        value={formData.contactPreference}
                        onChange={(e) => handleInputChange('contactPreference', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Template-specific fields */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Specific Requirements</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add details specific to your query type</p>
                </div>
                <div className="p-6">
                  {renderTemplateForm()}
                </div>
              </div>

              {/* Submit Button */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center space-x-2"
                  >
                    {loading && (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    )}
                    <span>{loading ? 'Posting...' : 'Post Query'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostQuery; 