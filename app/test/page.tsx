export default function TestPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Test Page - Deployment Working!</h1>
        <p className="text-lg text-gray-600">If you can see this, the basic deployment is successful.</p>
        <div className="mt-8 p-4 bg-green-100 rounded-lg">
          <p className="text-green-800">✅ Next.js is running</p>
          <p className="text-green-800">✅ React is working</p>
          <p className="text-green-800">✅ Basic routing is functional</p>
        </div>
      </div>
    </div>
  );
}