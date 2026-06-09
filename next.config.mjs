/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental:{serverComponentsExternalPackages:['@google-cloud/documentai','sharp']},
  webpack:(config)=>{config.resolve.alias.canvas=false;return config}
}
export default nextConfig
