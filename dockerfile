# 1. Use the lightweight Nginx Alpine image
FROM nginx:alpine

# 2. Remove the default Nginx static files
RUN rm -rf /usr/share/nginx/html/*

# 3. Copy your project files (index.html, etc.) into the Nginx web root
# The "." refers to your current folder on EC2/GitHub
COPY . /usr/share/nginx/html/

# 4. Expose port 80 (standard HTTP port)
EXPOSE 80

# 5. Nginx starts automatically in this image, so no CMD is strictly needed,
# but you can add it for clarity:
CMD ["nginx", "-g", "daemon off;"]