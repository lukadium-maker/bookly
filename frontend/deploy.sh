#!/bin/bash
echo "Building frontend..."
npm run build
echo "Copying landing page..."
cp /root/app/static/landing.html /root/app/frontend/dist/landing.html
echo "Done!"
