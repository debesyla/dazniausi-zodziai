# Deployment Guide

## GitHub Pages Setup

This project is configured to deploy automatically to GitHub Pages using GitHub Actions.

### Initial Setup

1. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Select "GitHub Actions"
   - The site will be available at: `https://<username>.github.io/dazniausi-zodziai`

2. **Configure Permissions**:
   - Go to Settings → Actions → General
   - Under "Workflow permissions", ensure "Read and write permissions" is selected
   - Check "Allow GitHub Actions to create and approve pull requests"

3. **Push to Main Branch**:
   - Any push to the `main` branch will trigger automatic deployment
   - The workflow file is at `.github/workflows/deploy.yml`

### Manual Deployment

To manually trigger deployment:
1. Go to Actions tab in GitHub
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow"

### Local Preview

To preview the production build locally:

```bash
# Build the production version
npm run build

# Preview the build
npm run preview
```

The site will be available at `http://localhost:4173/dazniausi-zodziai`

### Deployment Checklist

Before deploying, verify:
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors in preview
- [ ] Analytics tracking works
- [ ] All features function correctly

### Post-Deployment Validation

After deployment, check:
1. Visit the live URL
2. Verify all features work
3. Check browser console for errors
4. Test on multiple devices/browsers
5. Verify analytics is tracking visits

See `docs/qa/gates/post-launch-checklist.md` for complete validation checklist.

### Troubleshooting

**404 Errors**: Ensure GitHub Pages is enabled in repository settings

**Assets Not Loading**: Check that `base` path in `svelte.config.js` matches repository name

**Build Failures**: Check Actions tab for error logs

**Analytics Not Working**: Verify localStorage is accessible in browser

### Analytics

The site includes basic privacy-friendly analytics:
- Page views stored in browser localStorage
- No external tracking services
- No personal data collected
- View stats in browser console: `localStorage.getItem('pageViews')`
