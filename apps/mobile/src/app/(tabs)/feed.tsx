import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, RefreshControl,
  TextInput, Image, ScrollView, Modal, Alert, ActivityIndicator,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useAuth } from '@/lib/auth-context'
import { feedApi, uploadApi } from '@/lib/api'

const MAX_IMAGES = 4
const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface FeedPost {
  id: string
  content: string | null
  post_type: 'text' | 'photo' | 'video' | 'milestone'
  media_urls: string[]
  created_at: string
  user: { id: string; name: string; avatar_url: string | null }
  class_name: string | null
  reactions: { emoji: string; count: number; reacted: boolean }[]
}

interface SelectedImage {
  uri: string
  mimeType: string
}

export default function FeedScreen() {
  const { studioId } = useAuth()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [newPost, setNewPost] = useState('')
  const [composing, setComposing] = useState(false)
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<'front' | 'back'>('back')
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const cameraRef = useRef<CameraView>(null)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    try {
      if (studioId) {
        const data = await feedApi.getFeed(studioId) as FeedPost[]
        setPosts(data)
      } else {
        setPosts([])
      }
    } catch (e) {
      console.error('Failed to load feed:', e)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [studioId])

  useEffect(() => { loadFeed() }, [loadFeed])

  async function pickFromGallery() {
    const remaining = MAX_IMAGES - selectedImages.length
    if (remaining <= 0) {
      Alert.alert('Limit reached', `You can attach up to ${MAX_IMAGES} images per post.`)
      return
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to select images.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    })

    if (!result.canceled && result.assets.length > 0) {
      const newImages = result.assets.slice(0, remaining).map(asset => ({
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
      }))
      setSelectedImages(prev => [...prev, ...newImages])
      if (!composing) setComposing(true)
    }
  }

  async function openCamera() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission()
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow camera access to take photos.')
        return
      }
    }
    setCameraOpen(true)
  }

  async function takePicture() {
    if (!cameraRef.current) return
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
    if (photo) {
      setCapturedPhoto(photo.uri)
    }
  }

  function usePhoto() {
    if (!capturedPhoto) return
    if (selectedImages.length >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can attach up to ${MAX_IMAGES} images per post.`)
    } else {
      setSelectedImages(prev => [...prev, { uri: capturedPhoto, mimeType: 'image/jpeg' }])
    }
    setCapturedPhoto(null)
    setCameraOpen(false)
    if (!composing) setComposing(true)
  }

  function removeImage(index: number) {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
  }

  async function handlePost() {
    if ((!newPost.trim() && selectedImages.length === 0) || !studioId) return

    setUploading(true)
    try {
      let mediaUrls: string[] = []

      if (selectedImages.length > 0) {
        // Use a placeholder classId for feed-only posts
        const classId = 'feed'
        const uploads = await Promise.all(
          selectedImages.map(img =>
            uploadApi.uploadImage(studioId, classId, img.uri, img.mimeType)
          )
        )
        mediaUrls = uploads.map(u => u.url)
      }

      await feedApi.createPost(studioId, {
        content: newPost || '',
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      })

      setNewPost('')
      setSelectedImages([])
      setComposing(false)
      loadFeed()
    } catch (e) {
      console.error('Failed to create post:', e)
      Alert.alert('Error', 'Failed to create post. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleReact(postId: string, emoji: string) {
    if (!studioId) return
    try {
      await feedApi.react(studioId, postId, emoji)
      setPosts(posts.map(p => {
        if (p.id !== postId) return p
        const reactions = p.reactions.map(r =>
          r.emoji === emoji ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted } : r
        )
        return { ...p, reactions }
      }))
    } catch (e) {
      console.error('Failed to react:', e)
    }
  }

  function cancelCompose() {
    setComposing(false)
    setNewPost('')
    setSelectedImages([])
  }

  function renderImageGrid(urls: string[]) {
    if (urls.length === 0) return null
    if (urls.length === 1) {
      return (
        <TouchableOpacity onPress={() => setFullscreenImage(urls[0])} activeOpacity={0.9}>
          <Image source={{ uri: urls[0] }} className="w-full h-48 rounded-xl mt-2" resizeMode="cover" />
        </TouchableOpacity>
      )
    }
    // Grid layout for 2-4 images
    const rows = urls.length <= 2 ? [urls] : [urls.slice(0, 2), urls.slice(2)]
    return (
      <View className="mt-2 gap-1">
        {rows.map((row, ri) => (
          <View key={ri} className="flex-row gap-1">
            {row.map((url, ci) => (
              <TouchableOpacity
                key={ci}
                style={{ flex: 1, height: urls.length <= 2 ? 180 : 120 }}
                onPress={() => setFullscreenImage(url)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: url }} className="w-full h-full rounded-lg" resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFeed} />}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View className="mb-4">
            {composing ? (
              <View className="bg-card rounded-2xl border border-border p-4">
                <TextInput
                  className="text-foreground text-base min-h-[80px]"
                  placeholder="Share something with your studio..."
                  placeholderTextColor="#999"
                  multiline
                  value={newPost}
                  onChangeText={setNewPost}
                  autoFocus
                />

                {/* Selected image previews */}
                {selectedImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                    {selectedImages.map((img, i) => (
                      <View key={i} className="mr-2 relative">
                        <Image
                          source={{ uri: img.uri }}
                          className="w-20 h-20 rounded-lg"
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 items-center justify-center"
                          onPress={() => removeImage(i)}
                        >
                          <Ionicons name="close" size={12} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                {/* Action bar: camera, gallery, cancel, post */}
                <View className="flex-row items-center mt-3">
                  <TouchableOpacity onPress={openCamera} className="mr-3 p-1">
                    <Ionicons name="camera-outline" size={24} color="#6b6560" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={pickFromGallery} className="mr-3 p-1">
                    <Ionicons name="images-outline" size={24} color="#6b6560" />
                  </TouchableOpacity>
                  {selectedImages.length > 0 && (
                    <Text className="text-muted text-xs">{selectedImages.length}/{MAX_IMAGES}</Text>
                  )}
                  <View className="flex-1" />
                  <TouchableOpacity onPress={cancelCompose} className="mr-3">
                    <Text className="text-muted">Cancel</Text>
                  </TouchableOpacity>
                  {uploading ? (
                    <View className="bg-primary/50 rounded-full px-4 py-2 flex-row items-center">
                      <ActivityIndicator size="small" color="white" />
                      <Text className="text-white font-medium text-sm ml-2">Posting...</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      className="bg-primary rounded-full px-4 py-2"
                      onPress={handlePost}
                      disabled={!newPost.trim() && selectedImages.length === 0}
                    >
                      <Text className="text-white font-medium text-sm">Post</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View className="bg-card rounded-2xl border border-border p-4">
                <TouchableOpacity onPress={() => setComposing(true)}>
                  <Text className="text-muted">Share something with your studio...</Text>
                </TouchableOpacity>
                <View className="flex-row mt-3 pt-3 border-t border-border">
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center py-1"
                    onPress={openCamera}
                  >
                    <Ionicons name="camera-outline" size={20} color="#6b6560" />
                    <Text className="text-muted text-sm ml-1">Camera</Text>
                  </TouchableOpacity>
                  <View className="w-px bg-border" />
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center py-1"
                    onPress={pickFromGallery}
                  >
                    <Ionicons name="images-outline" size={20} color="#6b6560" />
                    <Text className="text-muted text-sm ml-1">Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        }
        renderItem={({ item: post }) => (
          <View className="bg-card rounded-2xl border border-border p-4 mb-3">
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-2">
                <Text className="text-primary font-bold text-sm">{post.user.name[0]}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-medium text-sm">{post.user.name}</Text>
                <Text className="text-muted text-xs">
                  {new Date(post.created_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {post.class_name && ` . ${post.class_name}`}
                </Text>
              </View>
            </View>

            {post.post_type === 'milestone' ? (
              <View className="bg-yellow-50 rounded-xl p-3 items-center">
                <Text className="text-2xl">{'🏆'}</Text>
                <Text className="text-yellow-800 font-semibold mt-1">
                  {post.user.name} hit a milestone!
                </Text>
                {post.content && <Text className="text-yellow-700 text-sm mt-1">{post.content}</Text>}
              </View>
            ) : (
              post.content && <Text className="text-foreground text-base">{post.content}</Text>
            )}

            {renderImageGrid(post.media_urls)}

            <View className="flex-row gap-2 mt-3">
              {['\u2764\uFE0F', '\uD83D\uDD25', '\uD83D\uDC4F'].map(emoji => {
                const r = post.reactions.find(x => x.emoji === emoji)
                return (
                  <TouchableOpacity
                    key={emoji}
                    className={`flex-row items-center rounded-full px-2 py-1 ${r?.reacted ? 'bg-primary/10 border border-primary/30' : 'bg-secondary'}`}
                    onPress={() => handleReact(post.id, emoji)}
                  >
                    <Text className="text-sm">{emoji}</Text>
                    {r && r.count > 0 && (
                      <Text className={`text-xs ml-1 ${r.reacted ? 'text-primary font-medium' : 'text-muted'}`}>{r.count}</Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-20">
              <Text className="text-4xl mb-3">{'📸'}</Text>
              <Text className="text-foreground font-medium">No posts yet</Text>
              <Text className="text-muted text-sm mt-1">Be the first to share something!</Text>
            </View>
          ) : null
        }
      />

      {/* Camera Modal */}
      <Modal visible={cameraOpen} animationType="slide" presentationStyle="fullScreen">
        <View className="flex-1 bg-black">
          {capturedPhoto ? (
            // Preview captured photo
            <View className="flex-1">
              <Image source={{ uri: capturedPhoto }} className="flex-1" resizeMode="contain" />
              <View className="absolute bottom-12 left-0 right-0 flex-row justify-center gap-6 px-8">
                <TouchableOpacity
                  className="bg-white/20 rounded-full px-6 py-3 flex-row items-center"
                  onPress={() => setCapturedPhoto(null)}
                >
                  <Ionicons name="refresh-outline" size={20} color="white" />
                  <Text className="text-white font-medium ml-2">Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-primary rounded-full px-6 py-3 flex-row items-center"
                  onPress={usePhoto}
                >
                  <Ionicons name="checkmark" size={20} color="white" />
                  <Text className="text-white font-medium ml-2">Use Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Camera viewfinder
            <View className="flex-1">
              <CameraView
                ref={cameraRef}
                className="flex-1"
                facing={facing}
              />
              {/* Top bar */}
              <View className="absolute top-14 left-0 right-0 flex-row justify-between px-6">
                <TouchableOpacity
                  onPress={() => { setCameraOpen(false); setCapturedPhoto(null) }}
                  className="bg-black/40 rounded-full p-2"
                >
                  <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
                  className="bg-black/40 rounded-full p-2"
                >
                  <Ionicons name="camera-reverse-outline" size={28} color="white" />
                </TouchableOpacity>
              </View>
              {/* Capture button */}
              <View className="absolute bottom-12 left-0 right-0 items-center">
                <TouchableOpacity
                  onPress={takePicture}
                  className="w-18 h-18 rounded-full border-4 border-white items-center justify-center"
                  style={{ width: 72, height: 72 }}
                >
                  <View className="w-16 h-16 rounded-full bg-white" style={{ width: 60, height: 60 }} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Fullscreen Image Viewer */}
      <Modal visible={!!fullscreenImage} transparent animationType="fade">
        <View className="flex-1 bg-black">
          <TouchableOpacity
            className="absolute top-14 right-6 z-10 bg-black/40 rounded-full p-2"
            onPress={() => setFullscreenImage(null)}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              className="flex-1"
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  )
}
